import { resolveSelectedLocalModel } from "./src/ollama.js";

const modeButtons = document.querySelectorAll(".mode-btn");
const modelDropdown = document.getElementById("modelDropdown");

modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        modeButtons.forEach((button) => button.classList.remove("active"));
        btn.classList.add("active");

        const choice = btn.innerText.toLowerCase();
        chrome.storage.local.set({ userChoice: choice }, () => {
            console.log("User mode saved:", choice);
        });
    });
});

chrome.storage.local.get(["userChoice"], (res) => {
    if (res.userChoice) {
        modeButtons.forEach((btn) => {
            btn.classList.remove("active");
            if (btn.innerText.toLowerCase() === res.userChoice) {
                btn.classList.add("active");
            }
        });
    }
});

async function populateModelDropdown() {
    try {
        const { selectedModel, models } = await resolveSelectedLocalModel();

        modelDropdown.innerHTML = "";

        if (!models || models.length === 0) {
            modelDropdown.innerHTML = "<option disabled>No local models found</option>";
            return;
        }

        models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model.name;
            option.innerText = model.name;
            modelDropdown.appendChild(option);
        });

        if (selectedModel) {
            modelDropdown.value = selectedModel;
        }
    } catch (err) {
        modelDropdown.innerHTML = "<option disabled>Ollama not running</option>";
        console.error("Failed to fetch models:", err);
    }
}

modelDropdown.addEventListener("change", () => {
    chrome.storage.local.set({ selectedLocalModel: modelDropdown.value }, () => {
        console.log("Selected local model saved:", modelDropdown.value);
    });
});

populateModelDropdown();

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["tokensSaved", "localQueries", "cloudQueries"], (res) => {
        document.getElementById("tokensSaved").innerText = res.tokensSaved || 0;
        document.getElementById("localQueries").innerText = res.localQueries || 0;
        document.getElementById("cloudQueries").innerText = res.cloudQueries || 0;
        updateEfficiency(res.localQueries || 0, res.cloudQueries || 0);
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== "local") return;

        if (changes.tokensSaved) {
            document.getElementById("tokensSaved").innerText = changes.tokensSaved.newValue;
        }

        if (changes.localQueries) {
            document.getElementById("localQueries").innerText = changes.localQueries.newValue;
        }

        if (changes.cloudQueries) {
            document.getElementById("cloudQueries").innerText = changes.cloudQueries.newValue;
        }

        if (changes.selectedLocalModel && changes.selectedLocalModel.newValue) {
            modelDropdown.value = changes.selectedLocalModel.newValue;
        }

        chrome.storage.local.get(["localQueries", "cloudQueries"], (res) => {
            updateEfficiency(res.localQueries || 0, res.cloudQueries || 0);
        });
    });

    document.querySelector(".reset-btn").addEventListener("click", () => {
        chrome.storage.local.set({ tokensSaved: 0, localQueries: 0, cloudQueries: 0 }, () => {
            document.getElementById("tokensSaved").innerText = 0;
            document.getElementById("localQueries").innerText = 0;
            document.getElementById("cloudQueries").innerText = 0;
            document.getElementById("efficiencyScore").innerText = "--";
        });
    });
});
