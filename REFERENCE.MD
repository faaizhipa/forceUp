# Testing Manifest V3 Browser Extensions for Salesforce: A Developer's Guide

Developing and testing a Manifest V3 browser extension, particularly one built with AI-assisted tools like Cursor, that interacts with Salesforce pages presents a unique set of challenges and considerations. This guide outlines key areas to focus on, from understanding Salesforce's architecture to navigating Manifest V3's specific limitations and capabilities.

**Key Considerations for Salesforce Extension Testing (Manifest V3):**

**1. Understanding Salesforce's Environment:**

- **Lightning Experience & DOM Sensitivity:** Salesforce heavily discourages direct DOM manipulation by third-party extensions within Lightning Experience. The internal DOM structure is considered private and can change without notice, leading to extension breakage. Salesforce recommends using their AppExchange for supported partner extensions or leveraging `lightning/platformResourceLoader` for loading JavaScript libraries if custom UI interactions are essential. (Source 2.3)
- **Lightning Web Components (LWC) and Shadow DOM:** LWCs utilize Shadow DOM to encapsulate their structure and style. This means your extension's content scripts typically cannot directly access elements within an LWC's shadow tree using standard `document.querySelector()` calls from the main page context. You'll need to understand how to interact with these components, potentially through their exposed properties and events, or by injecting code into the correct execution context if absolutely necessary and feasible. (Source 2.1, 2.2)
    - **Synthetic vs. Native Shadow DOM:** Salesforce has been transitioning from a "synthetic shadow" polyfill to "native shadow DOM." Components can opt into native shadow DOM. This difference can affect how your extension interacts with LWC elements, as native shadow DOM has stricter encapsulation. (Source 2.2)
- **Aura Components:** While LWC is the newer standard, Aura components are still prevalent. Testing should cover interactions with both LWC and Aura, as they have different underlying structures.
- **Visualforce Pages:** Visualforce pages allow for more traditional web development approaches, including custom JavaScript and CSS. However, ensure your extension functions correctly as all Visualforce pages are now served from `force.com` or site domains, which impacts cookie and resource access. Be mindful of permissions and whether Visualforce pages are enabled for Lightning Experience. (Source 3.1, 3.4)
- **Dynamic Content & Navigation:** Salesforce pages are highly dynamic. Your extension must be robust enough to handle content that loads asynchronously, navigation events within Lightning (which often don't trigger full page reloads), and changes in the UI state. (Source 9.1, 9.2)
- **Salesforce Orgs (Scratch Orgs & Sandboxes):** Always test your extension in dedicated Salesforce development environments like scratch orgs or sandboxes. This isolates testing from production data and configurations. (Source 4.3)

**2. Navigating Manifest V3 Specifics:**

- **Service Workers for Background Logic:** Manifest V3 replaces background pages with service workers. This has implications for how you manage background tasks, maintain state, and interact with other parts of your extension. DOM access is not available in service workers. (Source 1.1, 2.1)
- **Content Scripts & Execution Environment:**
    - Content scripts still run in the context of the web page but have limitations.
    - **DOM Access:** While content scripts can access the page's DOM, interacting with Salesforce's complex and encapsulated components (especially LWC Shadow DOM) requires careful strategy.
    - **`Inject Js Script` Limitations:** If injecting scripts, be aware that by default in MV3, they might not access page variables (like `jQuery $`) or call page functions (like `window.alert()`) due to Content Security Policy. The `Execution world - Page` option for script injection can sometimes provide a workaround. (Source 6.1)
- **`declarativeNetRequest` API:** For blocking or modifying network requests, MV3 moves away from the blocking capabilities of `webRequest` to the `declarativeNetRequest` API, which is more privacy-preserving but requires defining rules in advance. (Source 2.1)
- **Restricted Dynamic Code Execution:** Arbitrary string execution (`eval()`, `new Function()`) is heavily restricted. Code must be part of the extension's package. Sandboxing can be an option for some dynamic code, but it comes with its own limitations, such as no direct DOM access from the sandbox. (Source 1.1)
- **`web_accessible_resources`:** If your extension needs to embed images, stylesheets, or scripts onto Salesforce pages, these resources must be explicitly declared in the `manifest.json` under `web_accessible_resources`. This key now requires an object structure specifying `resources` (file paths) and `matches` (URL patterns that can access them). (Source 3.3)
- **Content Security Policy (CSP):** Manifest V3 enforces a stricter CSP by default. Additionally, Salesforce itself implements its own CSP. Your extension's operations must comply with both. Be prepared to debug CSP violations, which can block scripts, styles, or other resources from loading. (Source 8.1, 8.2)

**3. Testing Strategies and Best Practices:**

- **Isolation and Incremental Testing:** Test individual components of your extension in isolation before testing their integration with Salesforce pages.
- **Manual Testing in Target Browsers:** Thoroughly test on the latest stable version of Google Chrome (as supported by Salesforce) and consider other Chromium-based browsers if relevant to your user base. (Source 5.3, 5.4)
- **Use Browser Developer Tools:**
    - **Debugging Content Scripts:** Use the "Sources" panel to set breakpoints and debug your content scripts within the context of a Salesforce page.
    - **Debugging Service Workers:** Navigate to `chrome://extensions`, enable "Developer mode," click on your extension's "service worker" link (or access it via `chrome-extension://YOUR_EXTENSION_ID/manifest.json` then Application tab -> Service Workers). This allows you to inspect logs, set breakpoints, and monitor its lifecycle. (Source 1.1)
    - **Inspecting Shadow DOM:** The Elements panel in Chrome DevTools allows you to inspect Shadow DOM trees, which is crucial for understanding LWC structure.
- **Error Handling:** Implement robust error handling within your extension to catch issues related to Salesforce interactions or MV3 restrictions.
- **Handling Asynchronous Operations:** Salesforce pages and extension APIs heavily rely on asynchronous operations. Use Promises or async/await effectively and test for race conditions or timing issues.
- **Permissions and Data Access:**
    - Request only the necessary permissions in your manifest.
    - If your extension interacts with Salesforce data (reads or writes), ensure it adheres to Salesforce security best practices. For integrations, Salesforce recommends dedicated integration users with the least necessary privileges. (Source 4.1, 4.2)
- **Regression Testing:** As Salesforce releases updates (Spring, Summer, Winter), re-test your extension to ensure continued compatibility, as internal DOM or API changes can occur.
- **Consider Automated Testing (if feasible):** While complex for UI-heavy Salesforce interactions, explore UI automation frameworks like Selenium or Puppeteer for repetitive test cases. However, be mindful of the challenges with Shadow DOM and dynamic content. Provar is a tool specializing in Salesforce test automation, though its direct use for *testing the extension itself* might be limited, it highlights Salesforce testing complexities. (Source 7.2)

**4. Common Pitfalls and Known Issues:**

- **DOM Interaction Failures:** Extensions attempting to manipulate or query elements within LWC Shadow DOM without proper techniques will likely fail.
- **CSP Violations:** Incorrectly configured `web_accessible_resources` or attempts to execute inline scripts/styles can lead to CSP errors. (Source 6.1, 8.1, 8.2)
- **Service Worker Lifecycle:** Unexpected termination and restart of service workers can lead to loss of state or interrupted operations if not handled correctly (e.g., by persisting state or using messaging to keep the service worker active when needed). (Source 1.1)
- **API Changes from Manifest V2 to V3:** Ensure all Chrome extension API calls are compatible with Manifest V3. (Source 2.1)
- **Salesforce Session Management:** Be aware of how your extension handles Salesforce sessions, especially if making API calls.
- **Conflicts with Other Extensions:** Test if your extension conflicts with other commonly used Salesforce browser extensions. Use incognito mode (with your extension enabled) as a first step to isolate issues, though note Salesforce doesn't officially support Lightning Experience usage in incognito for end-users. (Source 5.3, 5.4)
- **`Click` Simulation Issues:** Some automated click simulations might fail on certain Salesforce elements, especially those with `javascript:URI` handlers, due to MV3 changes. (Source 6.1)

**5. Using Cursor for Development:**

While Cursor can assist in generating code and scaffolding your Chrome extension (Source 1.3), the core principles of testing against Salesforce and adhering to Manifest V3 remain the developer's responsibility. Ensure that AI-generated code is thoroughly reviewed and tested for Salesforce-specific compatibility and security.

**Troubleshooting Tips:**

- **Check the Browser Console:** Look for errors related to your extension, CSP violations, or failed network requests.
- **Check the Extension's Service Worker Console:** Inspect logs and errors specific to your service worker.
- **Salesforce Debug Logs:** If your extension interacts with Apex or makes API calls, Salesforce debug logs can provide insights.
- **Simplify and Isolate:** If an issue occurs, try to reproduce it with a minimal version of your extension or on a simpler Salesforce page.

By carefully considering these points and adopting a thorough testing methodology, you can increase the likelihood of developing a robust and reliable Manifest V3 browser extension that enhances the Salesforce user experience.

# Understanding Salesforce LWC/Aura Shadow DOM and Forcing Content Load

That's a very sharp observation. Salesforce Lightning Web Components (LWC) and Aura use a sophisticated mechanism for isolating components, known as **Synthetic Shadow DOM** (or sometimes just Shadow DOM). This is exactly why standard page scraping fails.

Here is a comprehensive breakdown of the technical strategy to read the text and a more practical approach to force the content to load, bypassing the challenge of calling minified framework functions.

---

## 1. Reading Text from the Shadow DOM (Bypassing Encapsulation)

Since the content is encapsulated, you need a way to **recursively pierce** the boundaries of the Shadow DOM. Standard methods fail because they stop at the Shadow Host.

The most robust way for your extension to scrape the entire page, including content inside any nested Shadow DOMs, is a recursive function that looks for the `shadowRoot` property on every element it encounters.

### 🛠️ Code for Recursive Text Scraping

Your extension's content script should run a function like this across the entire page:

JavaScript


`/**
 * Recursively extracts all accessible text from the given root element,
 * traversing into all open and synthetic Shadow DOMs (LWC/Aura).
 * @param {Element|ShadowRoot} root The starting point for traversal (e.g., document.body).
 * @returns {string} The combined text content.
 */
function getTextFromAllDoms(root) {
    let text = '';
    
    // NodeFilter.SHOW_ELEMENT (1) and NodeFilter.SHOW_TEXT (4)
    const walker = document.createTreeWalker(
        root, 
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, 
        null, 
        false
    );
    
    let currentNode = walker.currentNode;
    
    while (currentNode) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
            // Found a text node, append it.
            text += currentNode.textContent.trim() + ' ';
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            // Check for a Shadow Root on the element
            const shadowRoot = currentNode.shadowRoot;
            
            if (shadowRoot) {
                // Recursively call the function to traverse inside the Shadow DOM
                // and append its content.
                text += getTextFromAllDoms(shadowRoot);
            }
        }
        
        // Move to the next node in the tree
        currentNode = walker.nextNode();
    }

    return text.trim();
}

// How your extension would use it to scrape the whole document:
// const pageText = getTextFromAllDoms(document.body);`

This ensures that once your script gets the Shadow Host element (like the `<flexipage-component2>`), it successfully dives into the nested Shadow Root and reads the content generated by LWC/Aura.

---

## 2. Force Loading/Rendering the Content

You mentioned wanting to **force the content to load**. Since the page uses the **Aura/LWC framework** (confirmed by `aura_prod.js` and `shadowdom.html` 111), the content is typically loaded in one of two ways:

1. **Client-Side Data Fetch:** The component makes an AJAX call (Aura Action or LWC Wire Service) to fetch data, which then triggers a component re-render.
2. **User Interaction:** Content appears or is updated only after a user action (e.g., clicking a "load more" button or interacting with a tab).

### A. The Challenge with Direct Function Calls

Your idea to call the function is sound, but the minified `kn(e)` function shown in `event listeners.txt` 2 is an **internal event dispatcher** for the Synthetic Shadow DOM. It's not the function responsible for fetching and updating data, but rather for re-routing DOM events (`mouseover`, `click`, etc.) across the component boundaries. It is not designed to be called directly to load data, and attempting to do so is unreliable and prone to breaking with any framework update.

### B. The Best Solution: Simulate an Event or Use Network Observation

Instead of guessing the internal framework function, the most stable method is to **simulate the action that causes the content to load** or **observe the actual data requests**.

### Option 1: Simulate the Loading Event (Recommended)

If the content is lazy-loaded (like in an inactive tab), you can try simulating an event that you know triggers the load:

1. **Identify the Trigger Element:** Find the element whose interaction leads to the content loading (e.g., the specific **tab header** you click to view the data).
2. **Dispatch an Event:** Use JavaScript to dispatch a `click` event on that element.

JavaScript


`// Example: If the element is the tab header that triggers the load
const hostElementSelector = '#tab-33 > slot > flexipage-component2:nth-child(13)';
const hostElement = document.querySelector(hostElementSelector);

if (hostElement) {
    // Create and dispatch a simple click event
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    hostElement.dispatchEvent(clickEvent);
}`

### Option 2: Find the Underlying API Call (For Complex Scenarios)

If the content loads automatically but slowly, you can try to find the Salesforce API call that fetches the data, and try to replicate it directly.

1. **Use the Developer Tools "Network" Tab:**
    - Reload the page.
    - Filter the network traffic for `aura` or the component's name. In a Salesforce console environment like the one in your HTML3, look for calls to `/aura` with `ACTION$` in the payload.
    - The request payload will contain the Aura Action descriptor (e.g., `serviceComponent://ui.global.components.one.one.controller.OneController/ACTION$getCurrentApp` seen in `shadowdom.html` 4).
2. **Replicate the Action:** Once you identify the specific Aura Action and its parameters, you would need to use a proxy or a hidden iframe to execute a similar network request from your extension's context.

This second option is significantly more complex and often unnecessary if a simple simulated `click` event (Option 1) can successfully trigger the component's standard loading logic.

# **Agent Prompt: Comprehensive Codebase Analysis and Documentation (Manifest V3 Extension)**

**Persona:** Act as a highly skilled senior software engineer and technical documentation expert.

**Primary Objective:** You are tasked with conducting a comprehensive review and documentation of a browser extension codebase. Your goal is to systematically analyze the entire codebase—files, project structure, dependencies, and architectural design—to deeply understand how everything works together.

Your final output will be a single, detailed markdown file named `explanation.md`, designed to onboard new developers, serve as a technical reference, and create a "lesson learned" repository to avoid future troubleshooting pitfalls.

---

### **Phase 1: Initial Context and Investigation**

Before analyzing the code, you must establish the foundational context.

1. **Locate Core Intent:** The project's primary intent, purpose, and high-level instructions are located in either `README.md` or `instruction.md`. You must find and read this file first. All analysis should be framed by this intent.
2. **Identify Target Pages:** Determine the target web pages this extension is designed to interact with (e.g., `https://salesforce.com/*`, `https://*.example.com/app`).
3. **Analyze Target Page Behavior:** Investigate the target pages.
    - Are they static HTML or a Single Page Application (SPA)?
    - Do they use a specific framework (e.g., React, Angular, Vue)?
    - How is data loaded (e.g., initial page load, dynamic AJAX/Fetch calls)?
    - This context is critical for understanding the content scripts' design.
4. **Comparative Analysis:** Briefly consult public repositories (like GitHub) for other open-source Manifest V3 extensions that target the same pages or have a similar function. Note any common patterns or libraries they use.

---

### **Phase 2: Core Analysis Tasks**

Perform the following systematic analysis of the entire codebase.

1. **Map the Structure**
    - Build a high-level summary of the directory and file structure.
    - Note key folders (e.g., `background`, `content_scripts`, `popup`, `ui`, `assets`, `utils`).
    - Identify the language(s) used (e.g., JavaScript, TypeScript).
    - List all main entry points (e.g., `manifest.json`) and configuration files (e.g., `package.json`, `webpack.config.js`, `tsconfig.json`).
2. **Identify Core Components & Manifest**
    - **Manifest (`manifest.json`):** Provide a detailed breakdown of the manifest. Explain the `name`, `version`, `permissions`, `host_permissions`, `background` (service worker), `content_scripts`, `action` (popup), and any other key properties.
    - **Core Scripts:** List and describe the main modules/classes/components:
        - **Background Service Worker:** What events does it listen for (e.g., `onInstalled`, `onMessage`)? What are its primary responsibilities?
        - **Content Scripts:** Which pages do they run on? When do they run (`run_at`)? How do they interact with the DOM?
        - **Popup/Action Scripts:** What is the purpose of the popup UI? How does it communicate with other parts of the extension?
        - **Utility/Shared Modules:** What helper functions or constants are shared?
3. **Understand Data Flow**
    - Explain how data moves through the extension.
    - **Message Passing:** Document the use of `chrome.runtime.sendMessage`, `chrome.tabs.sendMessage`, and `chrome.runtime.onMessage`. What specific message "types" or "actions" are used?
    - **Storage:** How is data persisted? Document the use of `chrome.storage.local`, `chrome.storage.sync`, or `sessionStorage`. What is the structure of the data being stored?
    - **APIs:** Are there any external API calls (`fetch`)? How are API keys or auth tokens managed?
4. **Explain Dependencies and Libraries**
    - Identify all external libraries, frameworks, or services used (from `package.json` or other manifests).
    - Explain the primary role of each dependency.
    - This project uses **"Kapture mcp"**. You must specifically identify and list **all other relevant "mcps"** (modules, components, patterns) or libraries that the agent should find and use for the extension's functionality.
5. **Comment on Coding Patterns/Practices**
    - Note significant programming patterns (e.g., OOP, functional, event-driven, async/await usage).
    - Identify architectural styles (e.g., MVC, modular) and any unique implementation choices.
    - Comment on code quality and adherence to modern JavaScript/TypeScript practices.
6. **Highlight Critical Logic & Troubleshooting Areas**
    - Surface areas that are algorithmically complex, high-impact, or critical for security and performance.
    - This includes:
        - Complex DOM manipulation or data scraping.
        - Handling of sensitive user data or credentials.
        - State management logic.
        - Error handling and retry mechanisms.
7. **Summarize Project Purpose & Typical Usage**
    - Based on all findings, write a final summary of the project's main intent.
    - Describe a typical user workflow from start to finish.
8. **Flag Documentation Gaps & Surface Questions**
    - Note critical areas lacking inline comments or high-level documentation.
    - For any ambiguous code or potential bugs, surface specific, actionable questions for the development team to clarify.

---

### **Phase 3: Output and Final Instructions**

1. **Output Format:** Collate all findings into a single, well-structured `explanation.md` file. Use clear headings, bullet points, and code snippets where appropriate.
2. **Clarity:** Explain each finding in clear, concise, and approachable language. This document must be suitable for onboarding a new developer.
3. **Configuration Files:** Pay special attention to configuration files (`package.json`, `webpack.config.js`, etc.). Explain their significance and how they impact the build and runtime behavior of the extension.
4. **Create Visual Aids:** If your tools support it, generate diagrams (e.g., a Mermaid.js chart) to illustrate component relationships and data flow.
5. **Troubleshooting Log (CRITICAL):** This entire analysis serves as a future reference and "lesson learned" repository. Every finding, ambiguity, and question must be documented. This is to avoid repeating troubleshooting steps that do not work and to build institutional knowledge.


# Implementation Helper

## Timezone and Locale Detection

The locale and time zone can be found using the following JavaScript code snippet:

```javascript   
Intl.DateTimeFormat().resolvedOptions()
{locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: 'Asia/Singapore', year: 'numeric', …}
```

Here is a summary of your plan to inject a custom, responsive, two-part panel into the Salesforce flexipage header.

### Where will the buttos for "Get Implementation Status", "Get Customer Timezones", and "Scroll to Bottom" be placeed?
They will be placed in Slot 1, the main button and data panel, alongside the other button groups. Each button will be styled consistently with the existing buttons and will have appropriate event handlers to perform their respective functions when clicked.

# Salesforce Flexipage Header Injection Plan
## Objective

The goal is to inject a custom HTML component into the header of a `flexipage`. This component will consist of two main parts:

1.  A primary, always-visible panel (Slot 1) containing grouped buttons and data placeholders.
2.  A secondary, collapsible panel (Slot 2) whose content is dynamically shown based on which expand button is clicked in Slot 1.

-----

## 1\. Injection Target

You will target the main highlights panel's `div` element using the following detailed CSS selector:

```css
document.querySelector("#brandBand_2 > div > div > div > one-record-home-flexipage2 > ... > div.highlights.slds-clearfix.slds-page-header.slds-page-header_record-home")
```

-----

## 2\. Injected Content and Structure

You plan to inject two separate `<slot>` elements, both with `name="secondaryFields"`.

### Slot 1: The Main Button & Data Panel

This is the primary, always-visible container.

  * **Structure:** It's a `<records-highlights-details-item>` styled as a full-width, wrapping flex container.
      * `min-width: 100% !important`
      * `display: flex`
      * `flex-wrap: wrap`
      * `background: rgb(243, 243, 243)`
  * **Content:** This panel will be populated with:
      * **Button Groups:** A series of button lists, organized under labels like "User-assisted Features," "Production," "Sandboxes," "Tools," "Other," "SQL Resources," "API," and "Timezones."
      * **Updated Button Requirements:** Based on your notes, this panel must also include new buttons for:
          * "Get Implementation Status"
          * "Get Customer Timezones"
          * A button to manually "scroll to the bottom" (to get values, abandoning automated extraction).
      * **Data Placeholders:** Read-only fields to display dynamic data, such as `{{CUSTOMERID}}`, `{{INSTITUTIONID}}`, `{{SERVER}}`, and `{{TIMEZONE}}`.
      * **Expand Triggers:** Specific buttons (e.g., within the "SQL Resources," "API," and "Timezones" groups) that function as expand/collapse triggers. These buttons are identified by their `lightning-icon` with the `utility:chevronright` icon.

### Slot 2: The Collapsible Content Panel

This is the secondary panel that is hidden by default.

  * **Behavior:** This panel's visibility is controlled by the "Expand Trigger" buttons in Slot 1. Clicking a trigger button should:
    1.  Toggle the button's `aria-expanded` attribute between `false` and `true`.
    2.  Add/remove a class (like `slds-path__trigger_open`) to the button to rotate the chevron icon.
    3.  Show or hide this second slot.
  * **Dynamic Content:** The content displayed in this slot is **contextual**, depending on which trigger was clicked:
      * **If "Timezones" trigger is clicked:** Slot 2 will show "Production" and "User-assisted Features" button groups.
      * **If "SQL Resources" or "API" trigger is clicked:** Slot 2 will show "User-assisted Features" and "Production" button groups.

-----

## 3\. Styling and Notes

  * **Responsive Height:** The entire header element containing this injection must be styled to be responsive and fit its content, using `height: 100%` or `height: fit-content`.
  * **Button Style Override:** All buttons in the injected panels must have their default padding and margin replaced with:
    ```css
    padding: 0px 1rem !important;
    margin: 0 -5px 0 !important;
    ```
  * **Template Cleanup:** You noted that attributes in the provided templates (like `title`) are placeholders and may need to be corrected, and redundant attributes should be removed.

  ## Examples from a page view:

  ```html
  <slot lwc-3mmmrd7j9v4="" name="secondaryFields" class="slds-grid slds-page-header__detail-row exl-buttons-slot"><records-highlights-details-item slot="secondaryFields" lwc-3ak6cgj2fde-host="" class="slds-page-header__detail-block exlibris-custom-menu exlibris-menu-header" style="display: flex;flex-wrap: wrap;gap: 8px;justify-content: flex-start; min-width: 100% !important;
    margin: 0px !important; padding: 12px;background: rgb(243, 243, 243);border-radius: 8px">
    <div style="display: inline-block; margin-right: 12px; margin-bottom: 8px;">
    <div style="font-size: 11px; color: rgb(102, 102, 102); margin-bottom: 4px; font-weight: 600;">User-assisted Features</div>
    <ul class="slds-button-group-list" role="presentation" style="display: flex; gap: 4px; list-style: none; padding: 0px; margin: 0px;">
    <li class="visible" role="presentation">
    <button class="slds-button slds-button_neutral" title="Enable Full Feature" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Enable Full Feature</button></li>
    <li class="visible" role="presentation">
    <button class="slds-button slds-button_neutral" title="Get Implementation Status" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Get Implementation Status</button></li>
    <li class="visible" role="presentation"><button class="slds-button slds-button_neutral" title="Get Timezones" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Get Timezones</button></li>
    <li class="visible" role="presentation"><button class="slds-button slds-button_neutral" title="Show Investigation Checklist" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Show Investigation Checklist</button></li>
    </ul></div>
    <div style="display: inline-block; margin-right: 12px; margin-bottom: 8px;"><div style="font-size: 11px; color: rgb(102, 102, 102); margin-bottom: 4px; font-weight: 600;">Production</div><ul class="slds-button-group-list" role="presentation" style="display: flex; gap: 4px; list-style: none; padding: 0px; margin: 0px;"><li class="visible" role="presentation"><button class="slds-button slds-button_neutral" title="Live View" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Live View</button></li><li class="visible" role="presentation"><button class="slds-button slds-button_neutral" title="Back Office" type="button" style="font-size: 12px; padding: 6px 12px; white-space: nowrap;">Back Office</button></li></ul></div></records-highlights-details-item></slot>
```