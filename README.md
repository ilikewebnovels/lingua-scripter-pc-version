# Lingua Scripter by Subscribe

An AI-powered desktop application for translating novels, featuring project management, chapter organization, character tracking, and a customizable glossary to ensure consistent, high-quality translations. All your data is stored securely on your local machine.

<!-- Placeholder for a screenshot -->
_A screenshot of the main application interface will be added here._

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [One-Click Launch (Recommended)](#one-click-launch-recommended)
  - [Manual Setup](#manual-setup)
- [Usage](#usage)
- [Data & Privacy](#data--privacy)
- [License](#license)

## Key Features

-   **🗂️ Project & Chapter Management**: Organize your work by projects, each with its own chapters and settings.
-   **📖 Custom Glossary**: Define translations for specific terms on a per-project basis to maintain narrative consistency (e.g., character names, locations, special terms).
-   **👥 Character Database & Highlighting**: Automatically detect characters from your text. Maintain a database with their original names, translated names, gender, and pronouns. Hover over names in the translation to see their details instantly.
-   **🔌 Expanded API Support**: Integrates with Google Gemini, DeepSeek, OpenRouter, and any OpenAI-compatible API, giving you a wide choice of models.
-   **🔄 Real-Time Streaming**: See translations appear as they are generated, providing a faster and more interactive experience.
-   **🎨 Customizable UI**: Personalize your workspace with multiple themes (Light, Dark, Blue) and adjustable font settings.
-   **💾 Local-First Data**: All your projects, chapters, and glossaries are saved directly to your computer in a `/data` folder. No cloud storage, no accounts needed.
-   **🔍 AI-Powered Glossary Tool**: Select text in your translation and automatically find the corresponding original phrase to add to your glossary.
-   **📄 PDF Export**: Export your translated chapters as a clean, printable PDF document.

## Technology Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS
-   **Backend**: Node.js, Express
-   **AI Models**: Google Gemini API (`@google/genai`), DeepSeek API, OpenRouter, OpenAI-compatible APIs

## Prerequisites

-   [Node.js](https://nodejs.org/) (version 18 or higher is recommended)
-   An API key for at least one of the supported services:
    -   **Google Gemini API Key**: You can obtain one for free from [Google AI Studio](https://aistudio.google.com/app/apikey).
    -   **DeepSeek API Key**: You can obtain one from the [DeepSeek Platform](https://platform.deepseek.com/).
    -   **OpenRouter API Key**: You can obtain one from the [OpenRouter website](https://openrouter.ai/).
    -   An **API Key and Endpoint URL** for your OpenAI-compatible service.

## Getting Started

### One-Click Launch (Recommended)

This project includes scripts that handle the entire setup and launch process for you.

#### For Windows Users

1.  Find and double-click the `start.bat` file in the project folder.

#### For macOS & Linux Users

1.  **First-Time Setup (One Time Only)**:
    - Open a terminal in the project folder.
    - Run `chmod +x start.sh` to make the script executable.
2.  **Running the App**:
    - Double-click the `start.sh` file.

The script will automatically install dependencies, start the necessary servers, and **open the application in your default web browser**.

### Manual Setup

For advanced users who prefer to run the servers manually:

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start the Backend Server**:
    ```bash
    npm start
    ```
    This will start the local API and data server on `http://localhost:3001`.
3.  **Start the Frontend Server** (in a new terminal):
    ```bash
    npm run dev
    ```
    This will start the Vite development server, typically on `http://localhost:5173`.

## Usage

1.  **Configure API Key**: When you first launch the app, click the **Settings icon** (⚙️) in the top-right corner. Select your desired API provider, enter your key(s) in the appropriate fields, and click **Save Settings**.
2.  **Create a Project**: In the sidebar, enter a name for your new project and click the add button.
3.  **Start Translating**:
    - Select your project.
    - Paste your original text into the left panel.
    - Click **Translate**.
4.  **Save Your Work**: Give your chapter a title and click **Save Chapter**. It will appear in the chapter list for your project.

## Data & Privacy

This application is designed with privacy as a priority.
-   **All data** (projects, chapters, glossaries, character databases, settings) is stored in JSON files within a `data` folder in the application's root directory.
-   Your API keys are stored locally and are only sent directly to the respective AI providers via the local server proxy.
-   No data is ever uploaded to any third-party server besides the Google Gemini, DeepSeek, OpenRouter, or your specified OpenAI-compatible endpoint for the translation service.

## License

This project is licensed under the MIT License.