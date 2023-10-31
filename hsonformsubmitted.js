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

logToConsoleAndArray("jsdeliver hsOnFormSubmitted script started");

// Declare ChiliPiper params
const cpTenantDomain = "omnipresent";
const cpRouterName = "book_a_call";

// Define HS FormIDs that should trigger Chili Piper
const chiliPiperForms = ["a077eb7b-965f-4716-9c26-b4248ad50743"];

// Common error handling function
function handleError(context, error) {
  errorToConsoleAndArray(`An error occurred in ${context}: ${error}`);
}

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
    const contactId = await window.fetchContactId(email);
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
function updateFormConversionIDInput(formId, formConversionIDName) {
    logToConsoleAndArray("onFormSubmit FormID: " + formId);
    logToConsoleAndArray("formConversionIDName: " + formConversionIDName);
    try {
      logToConsoleAndArray(`Attempting to update form with ID: ${formId} and Conversion ID Name: ${formConversionIDName}`);
      
      // Find the form element with the matching data-form-id
      const formElement = document.querySelector(`form[data-form-id="${formId}"]`);
      if (formElement) {
        logToConsoleAndArray('Form element found.');
        
        // Find the input element with name="web_event_conversion_id"
        const inputElement = formElement.querySelector('input[name="web_event_conversion_id"]');
        if (inputElement) {
          logToConsoleAndArray('Input element found.');
          
          // Update its value
          inputElement.value = formConversionIDName;
          logToConsoleAndArray(`Input element value updated to: ${formConversionIDName}`);
        } else {
          errorToConsoleAndArray('Input element with name="web_event_conversion_id" not found.');
        }
      } else {
        errorToConsoleAndArray('Form element with matching data-form-id not found.');
      }
    } catch (error) {
      errorToConsoleAndArray('An error occurred:', error);
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
