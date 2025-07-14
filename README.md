# Twoblade AI Bot

AI Bot for Twoblade with memory and advanced functions.

* Stores usernames and can count how many unique users it has seen.
* Stores the ***amount*** of messages it has seen.
* Stores the content of the past 400 messages (by default, can be increased) for chat context.
* Admin and banning functionality

This is the source code of HejBot, based off of the emexos' ai_bot.
Made in Node.JS

# Installation

### Install Node JS
  * Download Node JS LTS for all desktop platforms: [https://nodejs.org/](https://nodejs.org/)

### Install Dependencies
  * In the twoblade_ai_bot directory, install the required dependencies with this command:
    ```bash
    npm install
    ```
### Setup .env file
  * Edit the .env file, and fill in each field with your bot's values. For example:
    ```
    CF_CLEARANCE=qwertyuiopasdfghjklzxcvbnm1234567890
    TB_USERNAME=example
    TB_PASSWORD=12345
    GEMINI_API_KEY=qwertyuiopasdfghjklzcvbnm1234567890
    SUPER_ADMIN_USERNAME=example
    ```
## How to find your values
  * To find `CF_CLEARANCE`:
    1. Log into [twoblade.com](https://twoblade.com)
    2. Right click anywhere in the tab and select Inspect
    3. In your broswer:
    #### FireFox:
    Switch from the `Inspector` tab to the `Storage` tab, and under `Cookies` copy value of `cf_clearance`.
    #### Chromium based browsers:
    Switch to the `Application` tab, and under `Cookies` copy value of `cf_clearance`.
    #### Note: This value is different for every IP address

* To find `TB_USERNAME`:
    1. Copy your TwoBlade account username.

* To find `TB_PASSWORD`:
    1. Copy your TwoBlade account password.
       
* To find `GEMINI_API_KEY`:
  1. Copy your API key from [Google AI](https://makersuite.google.com/app) once you have created a MakerSuite project.

* To find `SUPER_ADMIN_USERNAME`:
  1. This can be the username of any TwoBlade account. The Super Admin will be able to add or remove admins who can control banned users. This will usually be your own TwoBlade username.

## To configure / personalize your bot:
 * Edit `ai.js` in the Bot directory with your bot prefix, Gemini prompt, and anything you wish.

## To run:
  * Simply execute in the twoblade_ai_bot directory:
    ```bash
    node index.js
    ```

