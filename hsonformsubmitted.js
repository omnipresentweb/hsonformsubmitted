// Initialize analytics SDKs
const analytics = // initialize analytics SDK
const heap = // initialize Heap SDK 
const mutiny = // initialize Mutiny SDK

// Declare ChiliPiper params
const cpTenantDomain = "omnipresent";
const cpRouterName = "book_a_call";

// Define HS FormIDs that should trigger Chili Piper
const chiliPiperForms = ["a077eb7b-965f-4716-9c26-b4248ad50743"];

// Reusable function to get form data
function getFormData(form) {
  return Object.fromEntries(
    Object.entries(form).map(([key, field]) => {
      const value = Array.isArray(field.value)
        ? field.value.toString().replaceAll(",", ";")
        : field.value;
      return [field.name, value];
    })
  );
}

// Reusable function to track conversions
function trackConversion(name) {
  // Mutiny
  mutiny.client.trackConversion({
    name
  });

  // Dreamdata
  const email = getFormData(form).email;
  if (email) {
    analytics.identify(null, {email});
    analytics.track(name);
  }

  // Heap
  heap.track(name, {email});
}

// Reusable function for onFormSubmitted
function onFormSubmitted(form, formId, conversionName) {
  // Track conversions
  trackConversion(conversionName);

  // Conditionally trigger Chili Piper
  if (chiliPiperForms.includes(formId)) {
    const formData = getFormData(form);
    ChiliPiper.submit(cpTenantDomain, cpRouterName, {
      map: true,
      lead: formData
    });
  }

  // Google Tag Manager
  window.dataLayer.push({
    event: 'hubspot-form-submit',
    'hs-form-guid': formId,
    conversionName
  });
}
