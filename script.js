// Teachable Machine URL configuration
const URL = "./tm-my-image-model/";

let model, webcam, maxPredictions;
let isScanning = false;
let isUiInitialized = false;
let animationId = null;
let predictionRowElements = {};

// DOM Elements
const btnToggleCamera = document.getElementById("btn-toggle-camera");
const btnText = document.getElementById("btn-text");
const cameraStatusBadge = document.getElementById("camera-status-badge");
const cameraStatusIndicator = cameraStatusBadge.querySelector(".status-indicator");
const cameraStatusText = document.getElementById("camera-status-text");

const modelStatusText = document.getElementById("model-status-text");
const modelStatusBadge = document.getElementById("model-status-badge");

const webcamViewport = document.getElementById("webcam-viewport");
const webcamContainer = document.getElementById("webcam-container");
const webcamPlaceholder = document.getElementById("webcam-placeholder");
const webcamLoader = document.getElementById("webcam-loader");
const scannerCard = document.querySelector(".scanner-card");

const heroPredictionBox = document.getElementById("hero-prediction-box");
const topPredictionName = document.getElementById("top-prediction-name");
const topPredictionPercent = document.getElementById("top-prediction-percent");
const glowIndicator = document.getElementById("glow-indicator");

const predictionList = document.getElementById("prediction-list");
const listPlaceholder = document.getElementById("list-placeholder");

// Attempt to load the model on page load for a seamless experience
window.addEventListener("DOMContentLoaded", () => {
    loadModel(true); // silent load on start
    
    // Link Hero "Start Scanning" button
    const btnHeroScan = document.getElementById("btn-hero-scan");
    if (btnHeroScan) {
        btnHeroScan.addEventListener("click", async () => {
            const scannerSection = document.getElementById("scanner-section");
            if (scannerSection) {
                scannerSection.scrollIntoView({ behavior: "smooth" });
            }
            // Wait a brief moment for scroll to complete, then start scanning
            setTimeout(async () => {
                if (!isScanning) {
                    await startScanning();
                }
            }, 800);
        });
    }
});

/**
 * Loads the Teachable Machine Model
 * @param {boolean} silent If true, won't show alert toast if loading fails
 */
async function loadModel(silent = false) {
    try {
        updateModelBadgeStatus("loading", "Loading AI...");
        
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";
        
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        updateModelBadgeStatus("ready", "AI Engine Ready");
        return true;
    } catch (error) {
        console.error("Error loading model:", error);
        updateModelBadgeStatus("missing", "AI Offline");
        if (!silent) {
            showToast("Model files not found. Make sure './tm-my-image-model/' contains model.json, metadata.json and weights.bin.");
        }
        return false;
    }
}

/**
 * Updates the Model Badge design and copy
 */
function updateModelBadgeStatus(status, text) {
    if (!modelStatusText || !modelStatusBadge) return;
    
    modelStatusText.innerText = text;
    
    // Clear status classes
    modelStatusBadge.style.borderColor = "";
    modelStatusBadge.style.color = "";
    
    if (status === "loading") {
        modelStatusBadge.style.borderColor = "var(--accent-warning)";
        modelStatusBadge.style.color = "var(--accent-warning)";
    } else if (status === "ready") {
        modelStatusBadge.style.borderColor = "var(--accent-success)";
        modelStatusBadge.style.color = "var(--accent-success)";
    } else if (status === "missing") {
        modelStatusBadge.style.borderColor = "var(--accent-danger)";
        modelStatusBadge.style.color = "var(--accent-danger)";
    }
}

// Camera Toggle Handler
btnToggleCamera.addEventListener("click", async () => {
    if (isScanning) {
        stopScanning();
    } else {
        await startScanning();
    }
});

/**
 * Starts camera scanning and model predictions
 */
async function startScanning() {
    // 1. Ensure model is loaded first
    if (!model) {
        showLoader("Initializing AI Engine", "Downloading neural weights...");
        const success = await loadModel(false);
        hideLoader();
        if (!success) return;
    }
    
    // 2. Setup webcam
    showLoader("Starting Camera", "Requesting webcam stream...");
    updateCameraBadgeStatus("loading", "Starting...");
    
    try {
        const flip = true; // flip webcam stream horizontally
        // Create standard Webcam element
        webcam = new tmImage.Webcam(400, 400, flip);
        await webcam.setup(); // request permission
        await webcam.play();
    } catch (err) {
        console.error("Camera error:", err);
        hideLoader();
        updateCameraBadgeStatus("inactive", "Camera Off");
        showToast("Webcam access denied. Please allow camera permissions and try again.");
        return;
    }
    
    // 3. Update viewports
    hideLoader();
    webcamPlaceholder.style.display = "none";
    webcamContainer.style.display = "block";
    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);
    
    // 4. Initialize prediction list elements if needed
    isUiInitialized = false;
    predictionRowElements = {};
    if (listPlaceholder) listPlaceholder.style.display = "none";
    
    // 5. Update state
    isScanning = true;
    scannerCard.classList.add("scanning");
    btnToggleCamera.classList.add("active");
    btnText.innerText = "Stop Camera";
    
    // Update button icon (video to video-off)
    const icon = btnToggleCamera.querySelector(".btn-icon");
    if (icon) {
        icon.setAttribute("data-lucide", "video-off");
        if (window.lucide) lucide.createIcons();
    }
    
    updateCameraBadgeStatus("active", "Scanning...");
    
    // 6. Run prediction loop
    animationId = window.requestAnimationFrame(loop);
}

/**
 * Stops camera scanning and resets viewport UI
 */
function stopScanning() {
    isScanning = false;
    
    // 1. Cancel requestAnimationFrame loop
    if (animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // 2. Stop camera stream
    if (webcam) {
        webcam.stop();
        webcam = null;
    }
    
    // 3. Reset UI states
    scannerCard.classList.remove("scanning");
    webcamContainer.style.display = "none";
    webcamContainer.innerHTML = "";
    webcamPlaceholder.style.display = "flex";
    
    btnToggleCamera.classList.remove("active");
    btnText.innerText = "Start Camera";
    
    const icon = btnToggleCamera.querySelector(".btn-icon");
    if (icon) {
        icon.setAttribute("data-lucide", "video");
        if (window.lucide) lucide.createIcons();
    }
    
    updateCameraBadgeStatus("inactive", "Camera Off");
    
    // Reset Hero box
    topPredictionName.innerText = "Ready to Scan";
    topPredictionPercent.innerText = "—";
    glowIndicator.style.opacity = "0.2";
    glowIndicator.style.boxShadow = "none";
    
    // Restore Prediction list placeholder
    predictionList.innerHTML = "";
    if (listPlaceholder) {
        listPlaceholder.style.display = "flex";
        predictionList.appendChild(listPlaceholder);
    }
}

/**
 * Continuous frames processing loop
 */
async function loop() {
    if (!isScanning) return;
    webcam.update(); // update the webcam frame
    await predict();
    animationId = window.requestAnimationFrame(loop);
}

/**
 * Classifies current webcam frame and updates layout
 */
async function predict() {
    if (!model || !webcam) return;
    
    const prediction = await model.predict(webcam.canvas);
    
    // Initialize prediction DOM rows on first prediction frame
    if (!isUiInitialized) {
        initPredictionUi(prediction);
        isUiInitialized = true;
    }
    
    let highestPrediction = { className: "", probability: -1 };
    
    // Update each class row UI
    prediction.forEach((pred) => {
        const percentage = Math.round(pred.probability * 100);
        
        // Track the highest prediction class
        if (pred.probability > highestPrediction.probability) {
            highestPrediction = pred;
        }
        
        const uiElements = predictionRowElements[pred.className];
        if (uiElements) {
            uiElements.progressBar.style.width = `${percentage}%`;
            uiElements.pctSpan.innerText = `${percentage}%`;
            uiElements.row.classList.remove("highest");
        }
    });
    
    // Update styling for the highest confidence detection
    if (highestPrediction.probability > 0) {
        const topRow = predictionRowElements[highestPrediction.className];
        if (topRow) {
            topRow.row.classList.add("highest");
        }
        
        // Update Hero element
        const topPct = Math.round(highestPrediction.probability * 100);
        topPredictionName.innerText = highestPrediction.className;
        topPredictionPercent.innerText = `${topPct}%`;
        
        // Adjust the neon border glow based on prediction confidence
        glowIndicator.style.opacity = Math.max(0.2, highestPrediction.probability);
        glowIndicator.style.boxShadow = `0 0 12px rgba(0, 212, 255, ${highestPrediction.probability * 0.8})`;
    }
}

/**
 * Dynamic creation of prediction progress rows
 */
function initPredictionUi(predictions) {
    predictionList.innerHTML = "";
    predictionRowElements = {};
    
    predictions.forEach((pred) => {
        const row = document.createElement("div");
        row.className = "prediction-row";
        
        const meta = document.createElement("div");
        meta.className = "prediction-meta";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "prediction-name";
        nameSpan.innerText = pred.className;
        
        const pctSpan = document.createElement("span");
        pctSpan.className = "prediction-pct";
        pctSpan.innerText = "0%";
        
        meta.appendChild(nameSpan);
        meta.appendChild(pctSpan);
        
        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-container";
        
        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressBar.style.width = "0%";
        
        progressContainer.appendChild(progressBar);
        row.appendChild(meta);
        row.appendChild(progressContainer);
        
        predictionList.appendChild(row);
        
        // Store reference to directly update in prediction frames
        predictionRowElements[pred.className] = {
            row: row,
            progressBar: progressBar,
            pctSpan: pctSpan
        };
    });
}

/**
 * Utility: Updates camera badge status
 */
function updateCameraBadgeStatus(status, text) {
    if (!cameraStatusText || !cameraStatusIndicator) return;
    
    cameraStatusText.innerText = text;
    cameraStatusIndicator.className = "status-indicator"; // reset
    
    if (status === "inactive") {
        cameraStatusIndicator.classList.add("inactive");
    } else if (status === "loading") {
        cameraStatusIndicator.classList.add("loading");
    } else if (status === "active") {
        cameraStatusIndicator.classList.add("active");
    }
}

/**
 * Loader overlays
 */
function showLoader(title, subtitle) {
    if (!webcamLoader) return;
    
    const h3 = webcamLoader.querySelector("h3");
    const p = webcamLoader.querySelector("p");
    
    if (h3) h3.innerText = title;
    if (p) p.innerText = subtitle;
    
    webcamLoader.style.display = "flex";
}

function hideLoader() {
    if (webcamLoader) {
        webcamLoader.style.display = "none";
    }
}

/**
 * Custom Toast notification helper
 */
function showToast(message) {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = "toast";
    
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "alert-circle");
    icon.className = "toast-icon";
    
    const text = document.createElement("span");
    text.innerText = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    toastContainer.appendChild(toast);
    
    // Load Lucide for new elements
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Auto-fade-out and destroy toast
    setTimeout(() => {
        toast.style.animation = "slideOut 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards";
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 5500);
}
