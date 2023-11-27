// Create an array to store logs and errors
const logArray = [];

// Function to add logs to the logArray
function logToConsoleAndArray(...messages) {
  /* console.log(...messages); */
  logArray.push(messages.join(" "));
}

// Function to add errors to the logArray
function errorToConsoleAndArray(...messages) {
  const formattedMessages = messages.map(message => 
    (message instanceof Error) ? `Error: ${message.message}` : message
  );
  logArray.push("ERROR:", formattedMessages.join(" "));
}

logToConsoleAndArray(
  "jsdeliver hsOnFormSubmitted started (Hubspot ContactID capture, Send Analytics Identity and Events, Form Submit to Chili Piper)"
);

// Common error handling function
function handleError(context, error) {
  errorToConsoleAndArray(`An error occurred in ${context}: ${error}`);
}

// Declare ChiliPiper params
const cpTenantDomain = "omnipresent";
const cpRouterName = "book_a_call";

// Define HS FormIDs that should trigger Chili Piper
const chiliPiperForms = ["a077eb7b-965f-4716-9c26-b4248ad50743"];

// Helper function to retrieve the value of a cookie by its name
function getCookieValueByName(cookieName) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${cookieName}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

// Async function set local storage from Hubspot API ContactID via cookied hubspotutk value
window.fetchContactId = async function (hubspotutk) {
  try {
    logToConsoleAndArray(`Fetching contact info for hubspotutk: ${hubspotutk}`);

    const response = await fetch(
      `https://user-analytics.omnipresent.workers.dev/?hubspotutk=${hubspotutk}`
    );

    if (!response.ok) {
      throw new Error(`Server returned an error: ${response.statusText}`);
    }

    const contactInfo = await response.json();

    logToConsoleAndArray("Contact Info received:", contactInfo);

    localStorage.setItem("hubspot_contactId", contactInfo.contactId);
    localStorage.setItem("hubspot_email", contactInfo.email);
    logToConsoleAndArray(
      "Local Storage hubspot_contactId set:",
      contactInfo.contactId
    );
    logToConsoleAndArray("Local Storage hubspot_email set:", contactInfo.email);
    identifyWithAnalytics();
  } catch (error) {
    errorToConsoleAndArray("Error:", error);
  }
};

function waitForCookie(cookieName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkCookie = () => {
      const cookieValue = getCookieValueByName(cookieName);

      if (cookieValue) {
        resolve(cookieValue);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${cookieName} cookie.`));
      } else {
        setTimeout(checkCookie, 100);
      }
    };

    checkCookie();
  });
}

async function checkAndFetchContactId() {
  try {
    const hubspotutk = await waitForCookie("hubspotutk");

    logToConsoleAndArray(
      `Calling fetchContactId with hubspotutk: ${hubspotutk}`
    );
    window.fetchContactId(hubspotutk);
  } catch (error) {
    errorToConsoleAndArray("Error:", error);
  }
}
checkAndFetchContactId();

// Called to wait for specific libraries like Heap or Mutiny to load before running other code
function waitForLibrary(namespace, property, maxRetries = 120) {
  let retries = 0;
  return new Promise((resolve, reject) => {
    const checkLibrary = () => {
      if (window[namespace] && window[namespace][property]) {
        resolve();
      } else if (retries >= maxRetries) {
        reject(
          new Error(`Reached max retries waiting for ${namespace}.${property}`)
        );
      } else {
        retries++;
        setTimeout(checkLibrary, 100);
      }
    };
    checkLibrary();
  });
}

// Function to get form data
function getFormData(form) {
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmitted script: getFormData started"
  );
  return Object.fromEntries(
    Object.entries(form).map(([key, field]) => {
      const value = Array.isArray(field.value)
        ? field.value.toString().replaceAll(",", ";")
        : field.value;
      return [field.name, value];
    })
  );
}

function waitForMethod(namespace, property, maxRetries = 180, interval = 100) {
  let retries = 0;
  return new Promise((resolve, reject) => {
    const checkMethod = () => {
      if (
        window[namespace] &&
        typeof window[namespace][property] === "function"
      ) {
        resolve();
      } else if (retries >= maxRetries) {
        reject(
          new Error(`Reached max retries waiting for ${namespace}.${property}`)
        );
      } else {
        retries++;
        setTimeout(checkMethod, interval);
      }
    };
    checkMethod();
  });
}

async function identifyWithAnalytics() {
  const contactId = localStorage.getItem("hubspot_contactId");
  const storedEmail = localStorage.getItem("hubspot_email");

  if (!contactId || !storedEmail) {
    handleError(
      "identifyWithAnalytics",
      "Contact ID or email not found in local storage."
    );
    return;
  }

  // Try to identify with Mutiny
  try {
    await waitForMethod("mutinyClient", "identify");
    window.mutinyClient.identify(contactId, { email: storedEmail });
    logToConsoleAndArray(
      `Sent identify call to Mutiny with contact ID: ${contactId} and email: ${storedEmail}`
    );
  } catch (error) {
    handleError("identifyWithMutiny", error);
  }

  // Try to identify with Heap
  try {
    await waitForMethod("heap", "identify");
    window.heap.identify(contactId);
    window.heap.addUserProperties({
      "email": storedEmail,
    });
    logToConsoleAndArray(
      `Sent identify call to Heap with contact ID: ${contactId}`
    );
  } catch (error) {
    handleError("identifyWithHeap", error);
  }
}

// Called from HS onFormSubmit embed to send conversion data to analytic tools
async function trackConversion(formId, formConversionIDName, email) {
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmit script: trackConversion started"
  );

  // Check if all parameters are received
  if (!formId || !formConversionIDName || !email) {
    errorToConsoleAndArray(
      "Missing parameters in trackConversion:",
      `formId: ${formId}, formConversionIDName: ${formConversionIDName}, email: ${email}`
    );
    return; // Exit the function early if any of the parameters are missing
  }

  localStorage.setItem("hubspot_email", email);

  // Google Tag Manager
  window.dataLayer.push({
    event: "hubspot-form-submit",
    "hs-form-guid": formId,
    formConversionIDName,
  });
  logToConsoleAndArray(
    `Datalayer push for GTM event: ${formId}, formConversionIDName: ${formConversionIDName}`
  );

  // Mutiny
  logToConsoleAndArray("Attempting to track conversion with Mutiny");
  try {
    await waitForLibrary("mutiny", "client", 50);

    if (window.mutiny && window.mutiny.client) {
      window.mutiny.client.trackConversion({
        name: formConversionIDName,
      });
      logToConsoleAndArray("Mutiny trackConversion ran successfully");
    } else {
      throw new Error("Mutiny client is not ready.");
    }
  } catch (error) {
    handleError("Mutiny trackConversion", error);
  }

  // Heap track form submission
  logToConsoleAndArray("Attempting to track form submission with Heap");
  try {
    await waitForLibrary("heap", "track", 100);
    heap.track("Form Submission", {
      email: email,
      hsFormConversionIdName: formConversionIDName,
    });
    logToConsoleAndArray("Heap track 'Form Submission' ran successfully");
  } catch (error) {
    handleError("Heap trackConversion", error);
  }

  // Fetch contact ID and identify with Mutiny and Heap
  logToConsoleAndArray("Attempting to identify with analytics");
  identifyWithAnalytics();
  logToConsoleAndArray("trackConversion function completed");

  // Dreamdata
  logToConsoleAndArray("Attempting to identify and track with Dreamdata");
  if (!email) {
    handleError(
      "Dreamdata trackConversion",
      new Error("Email is not defined.")
    );
  } else {
    try {
      await waitForLibrary("analytics", "identify", 50);
      analytics.identify(null, { email });
      analytics.track(formConversionIDName);
      logToConsoleAndArray("Dreamdata identify and track ran successfully");
    } catch (error) {
      handleError("Dreamdata trackConversion", error);
    }
  }
}

// Called from HS onFormSubmit embed to sent HS conversionID
function jrUpdateFormConversionIDInput(formId, formConversionIDName) {
  logToConsoleAndArray(
    "jrUpdateFormConversionIDInput - onFormSubmit FormID: " + formId
  );
  logToConsoleAndArray(
    "jrUpdateFormConversionIDInput - formConversionIDName: " +
      formConversionIDName
  );
  try {
    logToConsoleAndArray(
      `Attempting to update form with ID: ${formId} and Conversion ID Name: ${formConversionIDName}`
    );

    // Find the form element with the matching data-form-id
    const formElement = document.querySelector(
      `form[data-form-id="${formId}"]`
    );
    if (formElement) {
      logToConsoleAndArray("Form element found.");

      // Find the input element with name="web_event_conversion_id"
      const inputElement = formElement.querySelector(
        'input[name="web_event_conversion_id"]'
      );
      if (inputElement) {
        logToConsoleAndArray("Input element found.");

        // Update its value
        inputElement.value = formConversionIDName;
        logToConsoleAndArray(
          `Input element value updated to: ${formConversionIDName}`
        );
      } else {
        errorToConsoleAndArray(
          'Input element with name="web_event_conversion_id" not found.'
        );
      }
    } else {
      errorToConsoleAndArray(
        "Form element with matching data-form-id not found."
      );
    }
  } catch (error) {
    errorToConsoleAndArray("An error occurred:", error);
  }
}

// Called from HS Embed onFormSubmit to trigger CP and trackConversions function
async function jrOnFormSubmitted(form, formId, conversionName) {
  logToConsoleAndArray("jsdeliver jrOnFormSubmitted function started");
  let formData = null;

  try {
    await checkAndFetchContactId();
    formData = getFormData(form);
    const email = formData.email;
    await trackConversion(formId, conversionName, email);
    logToConsoleAndArray("jrOnFormSubmitted: trackConversion completed");
  } catch (error) {
    logToConsoleAndArray(`Error during trackConversion: ${error.message}`);
  }

  if (chiliPiperForms.includes(formId)) {
    try {
      if (typeof ChiliPiper !== "undefined" && formData) {
        ChiliPiper.submit(cpTenantDomain, cpRouterName, {
          map: true,
          lead: formData,
          onBookingSuccess: function () {
            heap.track("ChiliPiper Event", { event: "Booking Success" });
            logToConsoleAndArray("Chili Piper booking success event triggered.");
            try {
              updateLocalStorageEvent('chilipiper onBookingSuccess');
            } catch (error) {
              logToConsoleAndArray(`Error updating localStorage for Booking Success: ${error.message}`);
            }
          },
          onClose: function () {
            heap.track("ChiliPiper Event", { event: "Modal Closed" });
            logToConsoleAndArray("Chili Piper modal close event triggered.");
            try {
              updateLocalStorageEvent('chilipiper onClose');
            } catch (error) {
              logToConsoleAndArray(`Error updating localStorage for Modal Close: ${error.message}`);
            }
          },
        });
        logToConsoleAndArray(`Chili Piper form submitted for formId: ${formId}`);
      } else {
        logToConsoleAndArray("Chili Piper is undefined or formData is null.");
      }
    } catch (error) {
      logToConsoleAndArray(`Error during ChiliPiper submission: ${error.message}`);
    }
  }
}

function updateLocalStorageEvent(eventName) {
  try {
    const currentDateTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const existingValue = localStorage.getItem(eventName);
    const newValue = existingValue ? `${existingValue}, ${currentDateTime}` : currentDateTime;
    localStorage.setItem(eventName, newValue);
  } catch (error) {
    // Throw error to be caught in the calling function
    throw new Error(`LocalStorage update failed: ${error.message}`);
  }
}

// Send Mutiny experiments to analytics
document.addEventListener("DOMContentLoaded", async function () {
  try {
    await waitForLibrary("mutiny", "experiences", 50);
    await waitForLibrary("heap", "track", 50);

    if (window.mutiny.experiences.length === 0) {
      throw new Error("No valid data found in window.mutiny.experiences.");
    }

    window.mutiny.experiences.forEach(function (experienceData) {
      const { experience, variationName } = experienceData;
      const mutinyExperienceValue = `${experience} (${variationName})`;

      window._mfq.push(["setVariable", "Mutiny", mutinyExperienceValue]);
      heap.track("MutinyExperience", { experience, variation: variationName });

      logToConsoleAndArray(
        `Added Mutiny experience data: ${mutinyExperienceValue}`
      );
    });
  } catch (error) {
    handleError("DOMContentLoaded", error);
  }
});

// Start track Wistia Videos via Heap
var trackWistiaPlaysInHeap = function (video, percentage) {
  try {
    var reportingObject = {
      nameOfVideo: video.name(),
      percentageReached: percentage,
      duration: (video.duration() / 60).toFixed(2) + " minutes total",
    };
    window.heap.track("Wistia Video", reportingObject);
    logToConsoleAndArray(
      `Video Played: ${reportingObject.nameOfVideo}, Percentage Reached: ${
        reportingObject.percentageReached * 100
      }%, Duration: ${reportingObject.duration}`
    );
  } catch (error) {
    handleError("trackWistiaPlaysInHeap", error);
  }
};

/* Initialize all videos on the page to be handled by the Wistia integration */
window._wq = window._wq || [];
_wq.push({
  _all: function (video) {
    try {
      /* Define time markers in number of seconds */
      var quarterPlayed = Math.floor(video.duration() / 4),
        halfPlayed = Math.floor(video.duration() / 2),
        threeQuartersPlayed = quarterPlayed * 3;

      /*Track when a video is played */
      video.bind("play", function () {
        trackWistiaPlaysInHeap(video, 0);
      });

      /* Track quarters watched */
      video.bind("secondchange", function (s) {
        if (s === quarterPlayed) {
          trackWistiaPlaysInHeap(video, 0.25);
        }
        if (s === halfPlayed) {
          trackWistiaPlaysInHeap(video, 0.5);
        }
        if (s === threeQuartersPlayed) {
          trackWistiaPlaysInHeap(video, 0.75);
        }
      });

      /* Track videos finished */
      video.bind("end", function () {
        trackWistiaPlaysInHeap(video, 1);
      });
    } catch (error) {
      handleError("_wq video handling", error);
    }
  },
});
// End track Wistia Videos via Heap

console.log(logArray);