// Create an array to store logs and errors
const logArray = [];

// Function to add logs to the logArray
function logToConsoleAndArray(message) {
  console.log(message);
  logArray.push(message);
}

// Function to add errors to the logArray
function errorToConsoleAndArray(message) {
  console.error(message);
  logArray.push(`ERROR: ${message}`);
}

logToConsoleAndArray(
  "jsdeliver hsOnFormSubmitted started (Hubspot ContactID capture, Send Analytics Identity and Events, Form Submit to Chili Piper)"
);

// Declare ChiliPiper params
const cpTenantDomain = "omnipresent";
const cpRouterName = "book_a_call";

// Define HS FormIDs that should trigger Chili Piper
const chiliPiperForms = ["a077eb7b-965f-4716-9c26-b4248ad50743"];

// Common error handling function
function handleError(context, error) {
  errorToConsoleAndArray(`An error occurred in ${context}: ${error}`);
}

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
function waitForLibrary(namespace, property) {
  return new Promise((resolve, reject) => {
    const checkLibrary = () => {
      if (window[namespace] && window[namespace][property]) {
        resolve();
      } else {
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

// Called from HS onFormSubmit embed to send conversion data to analytic tools
async function trackConversion(formId, formConversionIDName, email) {
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmitted script: trackConversion started"
  );

  // Google Tag Manager
  window.dataLayer.push({
    event: "hubspot-form-submit",
    "hs-form-guid": formId,
    formConversionIDName,
  });

  // Mutiny
  await waitForLibrary("mutiny", "client");
  const mutinyClient = window.mutiny.client;
  mutinyClient.trackConversion({
    formConversionIDName,
  });

  // Dreamdata
  if (email) {
    await waitForLibrary("analytics");
    analytics.identify(null, { email });
    analytics.track(formConversionIDName);
  }

  // Heap track form submission
  await waitForLibrary("heap", "track");
  heap.track("Form Submission", {
    email: email,
    hsFormConversionIdName: formConversionIDName,
  });

  // Fetch contact ID and identify with Mutiny and Heap
  try {
    const contactId = localStorage.getItem("hubspot_contactId");
    const storedEmail = localStorage.getItem("hubspot_email");

    if (!contactId || !storedEmail) {
      throw new Error("Contact ID or email not found in local storage.");
    }

    if (typeof mutinyClient.identify === "function") {
      // Identify with Mutiny
      mutinyClient.identify(contactId, { email });
      logToConsoleAndArray(
        `Sent identify call to Mutiny with contact ID: ${contactId} and email: ${email}`
      );
    } else {
      errorToConsoleAndArray("Error: Mutiny identify method not found");
    }

    // Identify with Heap
    heap.identify(contactId);
    logToConsoleAndArray(
      `Sent identify call to Heap with contact ID: ${contactId}`
    );
  } catch (error) {
    handleError("trackConversion", error);
  }
}

// Called from HS onFormSubmit embed to sent HS conversionID
function jrUpdateFormConversionIDInput(formId, formConversionIDName) {
  logToConsoleAndArray("onFormSubmit FormID: " + formId);
  logToConsoleAndArray("formConversionIDName: " + formConversionIDName);
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
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmitted script: onFormSubmitted function started"
  );
  const formData = getFormData(form);
  const email = formData.email;

  // Run function trackConversions
  await trackConversion(formId, conversionName, email);

  // Conditionally trigger Chili Piper
  if (chiliPiperForms.includes(formId)) {
    await waitForLibrary("ChiliPiper");
    ChiliPiper.submit(cpTenantDomain, cpRouterName, {
      map: true,
      lead: formData,
    });
    logToConsoleAndArray(`Chili Piper form submitted for formId: ${formId}`);
  }
}

// Send Mutiny experiments to analytics
document.addEventListener("DOMContentLoaded", async function () {
  try {
    await waitForLibrary("mutiny", "experiences");
    await waitForLibrary("heap", "track");

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

console.log(logArray);
