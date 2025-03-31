document.addEventListener('DOMContentLoaded', function() {
    // --- Element Selection (Ensure all IDs match your HTML) ---
    const loadingScreen = document.getElementById('loading-screen');
    const sectorSelection = document.getElementById('sector-selection');
    const predictionArea = document.getElementById('prediction-area');
    const uploadSection = document.getElementById('upload-section');
    const sectorCards = document.querySelectorAll('.sector-card');
    const formContainer = document.getElementById('form-fields');
    const formTitle = document.getElementById('form-title');
    const predictionResultDiv = document.getElementById('prediction-result');
    // Note: predictionText, probabilityText, suggestionsArea, suggestionsList are INSIDE predictionResultDiv and created dynamically
    const predictionLoading = document.getElementById('prediction-loading');
    const backToSectorsBtn = document.getElementById('back-to-sectors');
    const backToSectorsFromUploadBtn = document.getElementById('back-to-sectors-from-upload');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('csv-file');
    const fileNameDisplay = document.getElementById('file-name-display'); // Keep selection
    const uploadStatusDiv = document.getElementById('upload-status');
    const uploadLoading = document.getElementById('upload-loading');
    // Note: analysisOutput is INSIDE uploadStatusDiv and created dynamically
    const menuIcon = document.getElementById('menu-icon');
    const navLinks = document.getElementById('nav-links');
    const snowContainer = document.getElementById('snow-container');
    const currentYearSpan = document.getElementById('current-year');

    console.log("DOM Loaded. Initializing script."); // Debug log

    if(currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Feature Definitions (Match Python FRONTEND_FEATURES) ---
    const SECTOR_FEATURES = {
        "banking": [
            { name: "CreditScore", label: "Credit Score", type: "number", placeholder: "e.g., 650" },
            { name: "Geography", label: "Geography", type: "select", options: ["France", "Spain", "Germany"] },
            { name: "Gender", label: "Gender", type: "select", options: ["Female", "Male"] },
            { name: "Age", label: "Age", type: "number", placeholder: "e.g., 35" },
            { name: "Tenure", label: "Tenure (Years)", type: "number", placeholder: "e.g., 5" },
            { name: "Balance", label: "Balance", type: "number", step: "any", placeholder: "e.g., 50000.00" },
            { name: "NumOfProducts", label: "Number of Products", type: "number", placeholder: "e.g., 1" },
            { name: "HasCrCard", label: "Has Credit Card?", type: "select", options: ["No", "Yes"], mapValue: true }, // mapValue helps send 0/1
            { name: "IsActiveMember", label: "Is Active Member?", type: "select", options: ["No", "Yes"], mapValue: true }, // mapValue helps send 0/1
            { name: "EstimatedSalary", label: "Estimated Salary", type: "number", step: "any", placeholder: "e.g., 80000.00" }
        ],
        "telecom": [
             { name: "state", label: "State (Abbr.)", type: "text", placeholder: "e.g., NY"},
             { name: "account_length", label: "Account Length (Days)", type: "number", placeholder: "e.g., 120" },
             { name: "area_code", label: "Area Code", type: "number", placeholder: "e.g., 415" },
             { name: "international_plan", label: "Int'l Plan?", type: "select", options: ["no", "yes"] }, // Send 'yes'/'no'
             { name: "voice_mail_plan", label: "VMail Plan?", type: "select", options: ["no", "yes"] }, // Send 'yes'/'no'
             { name: "number_vmail_messages", label: "# VMail Msgs", type: "number", placeholder: "e.g., 0" },
             { name: "total_day_minutes", label: "Total Day Mins", type: "number", step: "any", placeholder: "e.g., 180.5" },
             { name: "total_day_calls", label: "Total Day Calls", type: "number", placeholder: "e.g., 100" },
             { name: "total_day_charge", label: "Total Day Charge", type: "number", step: "any", placeholder: "e.g., 30.69" },
             { name: "total_eve_minutes", label: "Total Eve Mins", type: "number", step: "any", placeholder: "e.g., 200.1" },
             { name: "total_eve_calls", label: "Total Eve Calls", type: "number", placeholder: "e.g., 90" },
             { name: "total_eve_charge", label: "Total Eve Charge", type: "number", step: "any", placeholder: "e.g., 17.01" },
             { name: "total_night_minutes", label: "Total Night Mins", type: "number", step: "any", placeholder: "e.g., 210.3" },
             { name: "total_night_calls", label: "Total Night Calls", type: "number", placeholder: "e.g., 95" },
             { name: "total_night_charge", label: "Total Night Charge", type: "number", step: "any", placeholder: "e.g., 9.46" },
             { name: "total_intl_minutes", label: "Total Intl Mins", type: "number", step: "any", placeholder: "e.g., 10.5" },
             { name: "total_intl_calls", label: "Total Intl Calls", type: "number", placeholder: "e.g., 3" },
             { name: "total_intl_charge", label: "Total Intl Charge", type: "number", step: "any", placeholder: "e.g., 2.84" },
             { name: "customer_service_calls", label: "Cust Service Calls", type: "number", placeholder: "e.g., 1" }
        ],
        "saas": [
            { name: "subscription_plan", label: "Subscription Plan", type: "select", options: ["Basic", "Standard", "Premium", "Enterprise"] }, // Send plan name
            { name: "account_age_months", label: "Account Age (Months)", type: "number", placeholder: "e.g., 12" },
            { name: "monthly_active_users", label: "Monthly Active Users", type: "number", placeholder: "e.g., 150" },
            { name: "feature_usage_score", label: "Feature Usage Score", type: "number", step: "any", placeholder: "e.g., 0.75" },
            { name: "monthly_bill", label: "Monthly Bill ($)", type: "number", step: "any", placeholder: "e.g., 99.99" },
            { name: "late_payments", label: "Late Payments (Count)", type: "number", placeholder: "e.g., 1" },
            { name: "support_tickets", label: "Support Tickets", type: "number", placeholder: "e.g., 3" },
            { name: "avg_ticket_resolution_time", label: "Avg Ticket Res. (Hours)", type: "number", step: "any", placeholder: "e.g., 24.5" }
        ]
    };
    let currentSector = null;

    // --- Effects ---
    function startRain() {
        const rainContainer = document.querySelector('.rain-container');
        if (!rainContainer) return;
        for (let i = 0; i < 80; i++) { // Number of raindrops
            const drop = document.createElement('div');
            drop.classList.add('raindrop');
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = 0.5 + Math.random() * 0.5 + 's'; // Vary speed
            drop.style.animationDelay = Math.random() * 5 + 's'; // Vary start time
            drop.style.height = Math.random() * 60 + 20 + 'px'; // Vary length
            drop.style.opacity = Math.random() * 0.5 + 0.2; // Vary opacity
            rainContainer.appendChild(drop);
        }
    }

    function createSnowflake() {
        // Added check for snowContainer existence
        if (!snowContainer) {
            // console.warn("Snow container not found, cannot create snowflake.");
            return;
        }
        const flake = document.createElement('div');
        flake.classList.add('snowflake');
        const size = Math.random() * 4 + 2; // Size between 2px and 6px
        flake.style.width = `${size}px`;
        flake.style.height = `${size}px`;
        flake.style.left = Math.random() * 100 + 'vw';
        const duration = Math.random() * 5 + 5; // Duration between 5s and 10s
        flake.style.animationDuration = `${duration}s`;
        flake.style.animationDelay = `${Math.random() * 5}s`; // Stagger start times
        flake.style.opacity = Math.random() * 0.7 + 0.3; // Vary opacity

        snowContainer.appendChild(flake);

        // Remove snowflake after animation ends to prevent buildup
        setTimeout(() => {
            // Check if flake still has a parent before removing
            if (flake.parentNode) {
                flake.remove();
            }
        }, duration * 1000 + 500); // Remove slightly after animation ends
    }

    function startSnowfall() {
        // Added check for snowContainer existence
        if (!snowContainer) {
             console.warn("Snow container not found, cannot start snowfall.");
             return;
        }
        // Create initial batch and then interval
        for(let i=0; i < 30; i++){ createSnowflake(); } // Initial burst
         setInterval(createSnowflake, 700); // Add new flakes periodically
    }

    // --- Parallax and Thunder Effects ---
    const hero = document.querySelector('.hero');
    const heroBackground = document.querySelector('.hero-background');
    const thunderFlash = document.querySelector('.thunder-flash');

    // Parallax scroll effect
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        if (scrolled < window.innerHeight) {
            // Calculate scale based on scroll position
            const scale = 1 + (scrolled * 0.0003);
            const blur = Math.min(scrolled * 0.02, 5); // Max blur of 5px
            const translateY = scrolled * 0.5;
            
            heroBackground.style.transform = `scale(${scale}) translateY(${translateY}px)`;
            heroBackground.style.filter = `blur(${blur}px)`;
        }
    });

    // Thunder effect for primary buttons
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.addEventListener('click', (e) => {
            thunderFlash.classList.remove('active');
            void thunderFlash.offsetWidth; // Force reflow
            thunderFlash.classList.add('active');
        });
    });

    // --- Loading Screen Logic ---
    window.addEventListener('load', () => {
        console.log("Window loaded. Starting effects..."); // Debug log
        if (loadingScreen && document.querySelector('.rain-container')) startRain();
        setTimeout(() => { if (loadingScreen) loadingScreen.classList.add('loaded'); }, 3500); // Adjust timing as needed
        setTimeout(startSnowfall, 4300); // Start snow slightly after load screen disappears
    });


    // --- Navbar Mobile Menu ---
    if(menuIcon && navLinks) {
        menuIcon.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        // Close menu when a link is clicked
         navLinks.querySelectorAll('a').forEach(link => {
             link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                     navLinks.classList.remove('active');
                 }
             });
         });
    } else {
        console.warn("Navbar elements (menuIcon or navLinks) not found.");
    }

    // --- Navigation/UI Flow ---
    function showSection(sectionToShowId) {
        console.log("Showing section:", sectionToShowId); // Debug log
        [sectorSelection, predictionArea, uploadSection].forEach(section => {
            // Check if section element actually exists before adding class
            if(section) section.classList.add('hidden');
        });

        const sectionElement = document.getElementById(sectionToShowId);
        if (sectionElement) {
            sectionElement.classList.remove('hidden');
            // Scroll to the section smoothly
            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            console.error(`Section with ID ${sectionToShowId} not found. Defaulting to sector selection.`);
            if(sectorSelection) sectorSelection.classList.remove('hidden'); // Show default if target not found
        }
         // Reset states (check element existence before accessing properties)
         if(predictionResultDiv) predictionResultDiv.classList.add('hidden');
         if(uploadStatusDiv) uploadStatusDiv.classList.add('hidden');
         if(predictionLoading) predictionLoading.classList.add('hidden');
         if(uploadLoading) uploadLoading.classList.add('hidden');
         document.getElementById('churn-form')?.reset(); // Optional chaining in case form isn't present
         document.getElementById('upload-form')?.reset(); // Optional chaining

         // *** FIX for Error 1: Check if fileNameDisplay exists before setting text ***
         if(fileNameDisplay) {
             fileNameDisplay.textContent = 'No file selected';
         } else {
            // Optional: Only warn if we are trying to show the upload section, otherwise it might be fine
            // if (sectionToShowId === 'upload-section') {
            //      console.warn("fileNameDisplay element not found when showing upload section.");
            // }
         }
         // analysisOutput is created dynamically, no need to reset here
    }

    if(backToSectorsBtn) backToSectorsBtn.addEventListener('click', () => showSection('sector-selection'));
    if(backToSectorsFromUploadBtn) backToSectorsFromUploadBtn.addEventListener('click', () => showSection('sector-selection'));

     // Nav Links Event Listeners
     if(navLinks) {
         // Use a more specific selector if needed, e.g., '#nav-links a'
         navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const sectionId = href.substring(1);
                    const sectionElement = document.getElementById(sectionId);
                    // Only prevent default and show section for known section IDs
                     if (sectionElement && (sectionId === 'sector-selection' || sectionId === 'upload-section' || sectionId === 'prediction-area')) {
                         e.preventDefault();
                         showSection(sectionId);
                     } // Allow normal behavior for other links like '#about', '#contact', or just '#'
                }
            });
        });
    } else {
         console.warn("navLinks element not found, navigation links might not work.");
    }


    // --- Sector Card Click Handling ---
    sectorCards.forEach(card => {
        card.addEventListener('click', () => {
            const sector = card.getAttribute('data-sector');
            currentSector = sector;
            console.log("Sector selected:", sector); // Debug log
            if (!formContainer) {
                console.error("Form container #form-fields not found!");
                return;
            }
            generateForm(sector); // Generate form fields
            if (formTitle) {
                formTitle.innerHTML = `<span>Enter Customer Details for ${sector.charAt(0).toUpperCase() + sector.slice(1)}</span>`;
            } else {
                console.warn("Form title element #form-title not found.");
            }
            showSection('prediction-area'); // Show the form section
        });
    });

     // --- Dynamic Form Generation ---
     function generateForm(sector) {
        console.log("Generating form for sector:", sector); // Debug log
        if (!formContainer) { console.error("Cannot generate form: Form container is missing."); return; }

        formContainer.innerHTML = ''; // Clear previous form
        const features = SECTOR_FEATURES[sector];
        if (!features) {
            console.error("No features defined for sector:", sector);
            return;
        }

        features.forEach(feature => {
            const div = document.createElement('div');
            div.classList.add('form-group');

            const label = document.createElement('label');
            label.setAttribute('for', feature.name);
            label.textContent = feature.label;
            div.appendChild(label);

            let input;
            if (feature.type === 'select') {
                input = document.createElement('select');
                input.id = feature.name;
                input.name = feature.name;
                input.required = true;

                const placeholderOption = document.createElement('option');
                placeholderOption.value = "";
                placeholderOption.textContent = `--- Select ${feature.label} ---`;
                placeholderOption.disabled = true;
                placeholderOption.selected = true;
                input.appendChild(placeholderOption);

                feature.options.forEach(optionText => {
                    const option = document.createElement('option');
                    // Use mapValue to determine if we send 0/1 or the text
                    const optionValue = feature.mapValue ? (optionText.toLowerCase() === 'yes' ? 1 : 0) : optionText;
                    option.value = optionValue;
                    option.textContent = optionText;
                    input.appendChild(option);
                });
            } else { // type 'number' or 'text'
                input = document.createElement('input');
                input.type = feature.type;
                input.id = feature.name;
                input.name = feature.name;
                input.placeholder = feature.placeholder || feature.label;
                input.required = true;
                if (feature.step) input.step = feature.step;
                // Add min="0" for non-balance/score number fields if needed
                if (feature.type === 'number' && !['balance', 'creditscore', 'feature_usage_score'].includes(feature.name.toLowerCase())) {
                   // input.min = "0"; // Removed for now based on user input, can be re-added if needed
                }
            }
            div.appendChild(input);
            formContainer.appendChild(div);
        });
        console.log("Form fields generated."); // Debug log

        // Attach submit listener AFTER form fields are in the DOM
        const churnForm = document.getElementById('churn-form');
        if (churnForm) {
             console.log("Attaching submit listener to #churn-form"); // Debug log
             // Remove previous listener just in case, then add the new one
             churnForm.removeEventListener('submit', handlePredictionSubmit);
             churnForm.addEventListener('submit', handlePredictionSubmit);
        } else {
            console.error("Churn form element #churn-form not found after generation!");
        }
    }


    // --- Prediction Form Submission (with Fixes and Debugging) ---
    async function handlePredictionSubmit(event) {
        event.preventDefault(); // Prevent default page reload
        console.log("--- handlePredictionSubmit triggered ---"); // <<< DEBUG

        if (!currentSector) {
            console.error("No current sector selected!"); // <<< DEBUG
            displayPredictionError("No sector selected. Please choose a sector first.");
            return;
        }
        // Check crucial elements needed within this function
        if (!predictionLoading || !predictionResultDiv || !formContainer) {
            console.error("Required elements (predictionLoading, predictionResultDiv, or formContainer) not found!"); // <<< DEBUG
            alert("Internal Page Error: UI elements missing. Please reload."); // Inform user
            return;
        }

        predictionLoading.classList.remove('hidden');
        predictionResultDiv.classList.add('hidden'); // Hide previous results
        // *** FIX for Error 2: No need to access suggestionsArea here ***

        const formData = { sector: currentSector };
        const features = SECTOR_FEATURES[currentSector];
        let formIsValid = true;

        console.log("Gathering form data for sector:", currentSector); // <<< DEBUG

        // Clear previous visual errors
        formContainer.querySelectorAll('input, select').forEach(el => el.style.borderColor = ''); // Reset border

        features.forEach(feature => {
            const inputElement = document.getElementById(feature.name);
            if (inputElement) {
                formData[feature.name] = inputElement.value; // Get value
                 // Basic validation for required fields
                 if (inputElement.required && !inputElement.value) {
                     console.error(`Field ${feature.name} is required but empty.`); // <<< DEBUG
                     inputElement.style.borderColor = 'var(--danger-color)'; // Highlight error
                     formIsValid = false;
                 }
            } else {
                 // This is a critical error if an expected input is missing
                 console.error(`CRITICAL: Input element NOT FOUND for feature: ${feature.name}`); // <<< DEBUG
                 formIsValid = false;
            }
        });

         if (!formIsValid) {
             console.error("Form is invalid. Aborting prediction."); // <<< DEBUG
             predictionLoading.classList.add('hidden'); // Hide loading indicator
             displayPredictionError("Please fill in all required and highlighted fields."); // User message
             return; // Stop processing
         }

        console.log("Form data gathered:", formData); // <<< DEBUG
        let jsonBody;
        try {
            jsonBody = JSON.stringify(formData);
            console.log("JSON data prepared for sending:", jsonBody); // <<< DEBUG
        } catch (stringifyError) {
            console.error("Error stringifying formData:", stringifyError); // <<< DEBUG
            displayPredictionError("Internal error preparing data for submission.");
            predictionLoading.classList.add('hidden');
            return;
        }

        console.log("Attempting to fetch /predict..."); // <<< DEBUG

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonBody
            });

            console.log("Fetch response received, status:", response.status); // <<< DEBUG

            const responseText = await response.text();
            console.log("Raw response text:", responseText); // <<< DEBUG

            predictionLoading.classList.add('hidden'); // Hide loader now

            let result;
            try {
                result = JSON.parse(responseText); // Parse the text
                console.log("Parsed result from server:", result); // <<< DEBUG
            } catch (parseError) {
                console.error("Error parsing JSON response:", parseError); // <<< DEBUG
                console.error("Server response was:", responseText);
                displayPredictionError(`Error understanding server response (Status ${response.status}). Check console and backend logs.`);
                return;
            }

            if (!response.ok || result.error) {
                 const errorMsg = result.error || `Server returned status ${response.status}. Response: ${responseText.substring(0, 200)}`;
                 console.error("Server returned an error:", errorMsg); // <<< DEBUG
                 displayPredictionError(errorMsg);
            } else {
                console.log("Prediction successful. Displaying results."); // <<< DEBUG
                displayPredictionResult(result); // Creates suggestion elements
                fetchAndDisplaySuggestions(formData, result.prediction); // Call AFTER display
            }

        } catch (networkError) {
            console.error('Fetch Network Error:', networkError); // <<< DEBUG
            predictionLoading.classList.add('hidden');
            displayPredictionError(`Network error: ${networkError.message}. Could not reach server.`);
        }
    } // End handlePredictionSubmit

    // --- Display Prediction Result (Keep as is - dynamically creates structure) ---
    function displayPredictionResult(data) {
        console.log("Displaying prediction result:", data);
        if (!predictionResultDiv) { console.error("Prediction result div not found!"); return; }
        predictionResultDiv.innerHTML = '';
        const title = document.createElement('h3'); title.textContent = "Prediction Result"; predictionResultDiv.appendChild(title);
        const predPara = document.createElement('p'); predPara.id = 'prediction-text'; predPara.textContent = `Prediction: ${data.churn_label}`; predPara.className = data.prediction === 1 ? 'churn-positive' : 'churn-negative'; predictionResultDiv.appendChild(predPara);
        const probPara = document.createElement('p'); probPara.id = 'probability-text'; probPara.textContent = `Probability of Churn: ${(data.probability_churn * 100).toFixed(1)}%`; predictionResultDiv.appendChild(probPara);
        const suggArea = document.createElement('div'); suggArea.id = 'suggestions-area'; suggArea.classList.add('hidden'); suggArea.innerHTML = `<h4><i class="fas fa-lightbulb"></i> Preventive Suggestions:</h4><ul id="suggestions-list"></ul>`; predictionResultDiv.appendChild(suggArea);
        predictionResultDiv.classList.remove('hidden');
        predictionResultDiv.style.borderColor = data.prediction === 1 ? 'var(--danger-color)' : 'var(--success-color)';
    }

     // --- Display Prediction Error (Keep as is) ---
    function displayPredictionError(errorMessage) {
        console.error("Displaying prediction error:", errorMessage);
         if (!predictionResultDiv) { console.error("Prediction result div not found!"); return; }
         predictionResultDiv.innerHTML = '';
         const title = document.createElement('h3'); title.textContent = "Prediction Error"; title.style.color = 'var(--danger-color)'; predictionResultDiv.appendChild(title);
         const errorPara = document.createElement('p'); errorPara.textContent = errorMessage; errorPara.style.color = 'var(--danger-color)'; errorPara.style.fontWeight = '600'; predictionResultDiv.appendChild(errorPara);
         predictionResultDiv.classList.remove('hidden');
         predictionResultDiv.style.borderColor = 'var(--danger-color)';
    }

     // --- Fetch & Display Suggestions (Keep as is - finds elements dynamically) ---
    function fetchAndDisplaySuggestions(customerData, prediction) {
         console.log("Fetching/Displaying suggestions for prediction:", prediction);
         const currentSuggestionsArea = predictionResultDiv.querySelector('#suggestions-area');
         const currentSuggestionsList = predictionResultDiv.querySelector('#suggestions-list');
         if (!currentSuggestionsArea || !currentSuggestionsList) { console.error("Suggestion area or list element not found inside prediction result div!"); return; }
         currentSuggestionsList.innerHTML = '';
         let suggestions = [];
         if (prediction === 1) { suggestions = ["Offer a personalized retention discount or loyalty bonus.", "Schedule a proactive check-in call from a senior support agent.", "Provide targeted training/webinars on features they underutilize (if applicable).", "Review and resolve any outstanding support tickets promptly.", "Analyze usage patterns for potential friction points."]; if (customerData && customerData.customer_service_calls && parseInt(customerData.customer_service_calls) > 3) { suggestions.push("Investigate high support contact frequency; consider assigning dedicated support."); } }
         else { suggestions = ["Continue providing excellent service and value.", "Periodically check in to ensure ongoing satisfaction.", "Inform about new features or benefits relevant to their usage.", "Request feedback or testimonials."]; }
         if (suggestions.length > 0) { suggestions.forEach(s => { const li = document.createElement('li'); li.textContent = s; currentSuggestionsList.appendChild(li); }); currentSuggestionsArea.classList.remove('hidden'); console.log("Suggestions displayed."); }
         else { currentSuggestionsArea.classList.add('hidden'); console.log("No suggestions to display."); }
     }

    // --- File Upload Handling (Keep as is) ---
     if (fileInput && fileNameDisplay && uploadStatusDiv) {
         fileInput.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file selected';
             uploadStatusDiv.classList.add('hidden');
        });
     } else {
         console.warn("File input elements (csv-file, file-name-display, or upload-status) not found.");
     }

     if (uploadForm && fileInput && uploadLoading && uploadStatusDiv) {
        uploadForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log("--- Upload form submitted ---");
            if (!fileInput.files || fileInput.files.length === 0) {
                console.error("No file selected for upload.");
                displayUploadStatus("Error: Please select a CSV file first.", true);
                return;
            }
            const file = fileInput.files[0];
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadLoading.classList.remove('hidden');
            uploadStatusDiv.classList.add('hidden');
            console.log("Attempting to fetch /upload...");
            try {
                const response = await fetch('/upload', { method: 'POST', body: uploadFormData });
                console.log("Upload fetch response received, status:", response.status);
                const responseText = await response.text();
                console.log("Raw upload response text:", responseText);
                uploadLoading.classList.add('hidden');
                let result;
                try {
                     result = JSON.parse(responseText);
                     console.log("Parsed upload result:", result);
                } catch (parseError) {
                     console.error("Error parsing JSON response from /upload:", parseError);
                     console.error("Server response was:", responseText);
                     displayUploadStatus(`Error understanding server response (Status ${response.status}). Check console and backend logs.`, true);
                     return;
                }
                if (!response.ok || result.error) {
                     const errorMsg = result.error || `Upload failed (Status: ${response.status}). Response: ${responseText.substring(0, 200)}`;
                     console.error("Upload failed:", errorMsg);
                     displayUploadStatus(errorMsg, true);
                } else {
                     console.log("Upload successful. Displaying analysis.");
                     displayUploadStatus(result.message || `File '${file.name}' analyzed.`, false, result.analysis_result);
                }
            } catch (networkError) {
                console.error('Upload Fetch Network Error:', networkError);
                uploadLoading.classList.add('hidden');
                displayUploadStatus(`Network error: ${networkError.message}. Could not reach server.`, true);
            } finally {
                 if (uploadForm) uploadForm.reset();
                 if (fileNameDisplay) fileNameDisplay.textContent = 'No file selected';
                 console.log("Upload form reset.");
            }
        });
     } else {
         console.warn("Upload form elements (upload-form, csv-file, upload-loading, or upload-status) not found.");
     }

     // --- Display Upload Status (Keep as is) ---
     function displayUploadStatus(message, isError = false, analysisText = null) {
        console.log(`Displaying upload status: ${isError ? 'ERROR' : 'SUCCESS'} - ${message}`);
        if (!uploadStatusDiv) { console.error("Upload status div not found!"); return; }
        uploadStatusDiv.innerHTML = '';
        const title = document.createElement('h3'); title.textContent = isError ? "Upload Error" : "Analysis Result"; title.style.color = isError ? 'var(--danger-color)' : 'var(--dark-color)'; uploadStatusDiv.appendChild(title);
        const statusPara = document.createElement('p'); statusPara.textContent = message; statusPara.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)'; statusPara.style.fontWeight = '600'; uploadStatusDiv.appendChild(statusPara);
        if (analysisText && !isError) {
            console.log("Analysis text received, creating <pre> element.");
            const analysisPre = document.createElement('pre'); analysisPre.id = 'analysis-output'; analysisPre.textContent = analysisText; uploadStatusDiv.appendChild(analysisPre);
            uploadStatusDiv.style.borderColor = 'var(--primary-color)';
        } else {
             uploadStatusDiv.style.borderColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        }
        uploadStatusDiv.classList.remove('hidden');
    }

    // --- Initial State ---
    showSection('sector-selection'); // Start with sector selection visible
    console.log("Script initialization complete."); // Debug log

}); // End DOMContentLoaded