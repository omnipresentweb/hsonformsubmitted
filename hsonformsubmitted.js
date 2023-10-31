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

// Function to send conversion data to analytic tools
async function trackConversion(name, email) {
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmitted script: trackConversion started"
  );
  // Mutiny
  await waitForLibrary("mutiny", "client");
  const mutinyClient = window.mutiny.client;
  mutinyClient.trackConversion({
    name,
  });

  // Dreamdata
  if (email) {
    await waitForLibrary("analytics");
    analytics.identify(null, { email });
    analytics.track(name);
  }

  // Heap track form submission
  await waitForLibrary("heap", "track");
  heap.track("Form Submission", {
    email: email,
    hsFormConversionIdName: name, // Assuming the name parameter contains the formConversionIDName
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

// Reusable function for onFormSubmitted
async function onFormSubmitted(form, formId, conversionName) {
  logToConsoleAndArray(
    "jsdeliver hsOnFormSubmitted script: onFormSubmitted function started"
  );
  const formData = getFormData(form);
  const email = formData.email;

  // Track conversions
  await trackConversion(conversionName, email);

  // Conditionally trigger Chili Piper
  if (chiliPiperForms.includes(formId)) {
    await waitForLibrary("ChiliPiper");
    ChiliPiper.submit(cpTenantDomain, cpRouterName, {
      map: true,
      lead: formData,
    });
    logToConsoleAndArray(`Chili Piper form submitted for formId: ${formId}`);
  }

  // Google Tag Manager
  window.dataLayer.push({
    event: "hubspot-form-submit",
    "hs-form-guid": formId,
    conversionName,
  });
}

// Add your code here (from the provided code)
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

// After your code execution, you can inspect logArray in the console
console.log(logArray);
