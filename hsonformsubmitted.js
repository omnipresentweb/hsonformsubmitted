console.log("jsdeliver hsOnFormSubmitted script started");

// Initialize analytics SDKs
const analytics = // initialize analytics SDK
const heap = // initialize Heap SDK 
const mutiny = // initialize Mutiny SDK

// Declare ChiliPiper params
const cpTenantDomain = "omnipresent";
const cpRouterName = "book_a_call";

// Define HS FormIDs that should trigger Chili Piper
const chiliPiperForms = ["a077eb7b-965f-4716-9c26-b4248ad50743"];

// Function to get form data
function getFormData(form) {
    console.log("jsdeliver hsOnFormSubmitted script: getFormData started");
  return Object.fromEntries(
    Object.entries(form).map(([key, field]) => {
      const value = Array.isArray(field.value)
        ? field.value.toString().replaceAll(",", ";")
        : field.value;
      return [field.name, value];
    })
  );
}

// Function send conversion data to analytic tools
function trackConversion(name, email) {
    console.log("jsdeliver hsOnFormSubmitted script: trackConversion started");
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

    // Fetch contact ID and identify with Mutiny and Heap
    window.fetchContactId(email)
    .then(contactId => {
        if (typeof window.mutiny.client.identify !== 'function') {
        console.error('Error: Mutiny identify method not found');
        return;
        }

        // Identify with Mutiny
        window.mutiny.client.identify(contactId, { email });
        console.log('Sent identify call to Mutiny with contact ID:', contactId, 'and email:', email);

        // Identify with Heap
        heap.identify(contactId);
        console.log('Sent identify call to Heap with contact ID:', contactId);
    })
    .catch(error => console.error('Error:', error));
}

// Reusable function for onFormSubmitted
function onFormSubmitted(form, formId, conversionName) {
    console.log("jsdeliver hsOnFormSubmitted script: onFormSubmitted function started");
    const formData = getFormData(form);
    const email = formData.email;
  
    // Track conversions
    trackConversion(conversionName, email);
  
    // Conditionally trigger Chili Piper
    if (chiliPiperForms.includes(formId)) {
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
