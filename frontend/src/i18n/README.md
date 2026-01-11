### Multiple language support

| Go to                                         |
| --------------------------------------------- |
| [Module requirements](#module-requirements)   |
| [Current logic](#current-logic)               |
| [Workflow](#workflow)                         |
| [Files with UI text](#files-with-ui-text)     |
| [Files with UI errors](#files-with-ui-errors) |

## Module requirements

#### In this minor module, the objective is to ensure that your website supports multiple languages to cater to a diverse user base. Key features and goals include:

- Implement support for a minimum of three languages on the website to accommodate a broad audience.

  ```text
  NOTE - Fallback to English. Otherwise, user can choose between English, German, French and Japanese.
  ```

- Provide a language switcher or selector that allows users to easily change the website’s language based on their preferences.

  ```text
  NOTE - Currently, extremely basic selector. If time permits it, will work on a more modern/fancier one.
  ```

- Translate essential website content, such as navigation menus, headings, and key information, into the supported languages.

  ```text
  NOTE - Will also implement the translation of user-facing error messages to ensure better i18n compliance.
  ```

- Ensure that users can navigate and interact with the website seamlessly, regardless of the selected language.

- Consider using language packs or localization libraries to simplify the translation process and maintain consistency across different languages.

  ```text
  NOTE - Implementing own feature without library for learning purposes.
  ```

- Allow users to set their preferred language as the default for subsequent visits.

  ```text
  NOTE - Currently persistence is maintained using localStorage. Ultimately, will need to implement preferredLanguage in the DB.
  ```

This minor module aims to enhance the accessibility and inclusivity of your website by offering content in multiple languages, making it more user-friendly for a diverse international audience.

## Current logic

### <input type="checkbox"> 1. First visit (no stored preference)

On the first visit, when no language preference is stored yet, the app chooses a default language from the browser:

A. `navigator.languages[0]`  
B. `navigator.language`  
C. Fallback to `en`

Notes:

A. `navigator.languages[0]` often returns a locale such as `fr-CH` or `de-CH`.  
B. We map locales to supported base languages (`fr`, `de`, `en`, `ja`).  
C. If the result is not supported, we fall back to English.

### <input type="checkbox"> 2. User changes the language

If the user toggles the language, the choice is stored in `localStorage`.

A. Example: `lang = "ja"`  
B. This persists per browser profile on that device.  
C. The preference remains until the user changes it again or clears site data.

### <input type="checkbox"> 3. Returning visits in the same browser

On app startup, resolve the language using this priority order:

A. `localStorage` override  
B. Browser preference  
C. Fallback to English

Behaviour:

A. If `localStorage.lang` exists and is supported, use it every time.  
B. This stays true until the user changes it again or storage is cleared.  
C. Clearing cookies does not necessarily clear `localStorage`. Depending on the browser UI, the user might clear cookies only, site data only, or all browsing data.

### <input type="checkbox"> 4. Why we do not use cookies

We do not use cookies for language persistence because:

A. Cookies are sent to the server automatically (unnecessary overhead for client-only i18n)  
B. Cookies can be affected by `SameSite`, domain/subdomain scope, and expiration  
C. `localStorage` is simpler and stays fully client-side

### <input type="checkbox"> 5. Logged-in users (future improvement)

Currently, being logged in or logged out does not change the language experience.

Later, we will add persistence across browsers/devices for logged-in users using a `preferredLanguage` field in the database.

Future priority order:

A. User override in the UI (update database and `localStorage`)  
B. Database `preferredLanguage`  
C. `localStorage`  
D. Browser preference  
E. Fallback to English

## Workflow

<span style="color: #ed6c02;">in progress</span> | <span style="color: #2e7d32;">done</span> | <span style="color: grey;">disabled</span>

<ul style="list-style: none; padding-left: 0;">
  <li><input type="checkbox" style="accent-color: #ed6c02;" checked> Step 1 - UI text</li> 
  <li><input type="checkbox" style="accent-color: #2e7d32;" disabled> Step 2 - UI errors</li>
  <li><input type="checkbox" style="accent-color: #2e7d32;" disabled> Step 3 - DB preferences and routes</li>
  <li><input type="checkbox" style="accent-color: #2e7d32;" disabled> Step 4 - CI tests</li>
</ul>

## Files with UI text

| File name | Function name |
| --------- | ------------- |
| main.ts   |               |
|           |               |

## Files with UI errors
