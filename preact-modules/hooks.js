/**
 * useKV Hook
 * Key-Value storage hook with localStorage and Chrome Storage sync
 * 
 * Dependencies:
 * - Preact hooks (via preact-setup.js)
 * 
 * This hook provides a React-like interface for persistent storage
 * with automatic Chrome storage sync when available (for extension context)
 * 
 * Usage:
 * const [value, setValue] = useKV('my-key', 'default-value')
 */

import { useState, useEffect, useRef } from '../preact-setup.js'

/**
 * Check if Chrome storage API is available
 */
function isChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync
}

/**
 * Get value from storage (tries Chrome storage first, falls back to localStorage)
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {Promise<*>} Stored value or default
 */
async function getStorageValue(key, defaultValue) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.warn(`Chrome storage error for key "${key}":`, chrome.runtime.lastError)
          resolve(defaultValue)
          return
        }
        resolve(result[key] !== undefined ? result[key] : defaultValue)
      })
    })
  }
  
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(key)
    return stored !== null ? JSON.parse(stored) : defaultValue
  } catch (error) {
    console.warn(`localStorage parse error for key "${key}":`, error)
    return defaultValue
  }
}

/**
 * Set value in storage (tries Chrome storage first, falls back to localStorage)
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<void>}
 */
async function setStorageValue(key, value) {
  if (isChromeStorage()) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`Chrome storage set error for key "${key}":`, chrome.runtime.lastError)
          reject(chrome.runtime.lastError)
          return
        }
        resolve()
      })
    })
  }
  
  // Fallback to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`localStorage set error for key "${key}":`, error)
  }
}

/**
 * Custom hook for persistent key-value storage
 * Automatically syncs with Chrome storage in extension context
 * 
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {[*, Function]} Tuple of [value, setValue]
 */
export function useKV(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)
  const isMountedRef = useRef(true)

  // Initial load from storage
  useEffect(() => {
    isMountedRef.current = true
    
    getStorageValue(key, defaultValue).then((storedValue) => {
      if (isMountedRef.current) {
        setValue(storedValue)
        setIsLoaded(true)
      }
    })

    return () => {
      isMountedRef.current = false
    }
  }, [key, defaultValue])

  // Save to storage whenever value changes (but only after initial load)
  useEffect(() => {
    if (!isLoaded) return // Don't save during initial load
    
    setStorageValue(key, value).catch(error => {
      console.error(`Failed to save value for key "${key}":`, error)
    })
  }, [key, value, isLoaded])

  // Listen for storage changes from other tabs/contexts
  useEffect(() => {
    if (!isChromeStorage()) {
      // localStorage event listener
      const handleStorageChange = (e) => {
        if (e.key === key && e.newValue !== null) {
          try {
            const newValue = JSON.parse(e.newValue)
            setValue(newValue)
          } catch (error) {
            console.warn(`Failed to parse storage change for key "${key}":`, error)
          }
        }
      }
      
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    } else {
      // Chrome storage change listener
      const handleChromeStorageChange = (changes, areaName) => {
        if (areaName === 'sync' && changes[key]) {
          setValue(changes[key].newValue)
        }
      }
      
      chrome.storage.onChanged.addListener(handleChromeStorageChange)
      return () => chrome.storage.onChanged.removeListener(handleChromeStorageChange)
    }
  }, [key])

  return [value, setValue]
}

/**
 * Clear a specific key from storage
 * @param {string} key - Storage key to clear
 * @returns {Promise<void>}
 */
export async function clearKV(key) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.remove([key], () => {
        if (chrome.runtime.lastError) {
          console.warn(`Chrome storage remove error for key "${key}":`, chrome.runtime.lastError)
        }
        resolve()
      })
    })
  }
  
  localStorage.removeItem(key)
}

/**
 * Clear all keys from storage (use with caution!)
 * @returns {Promise<void>}
 */
export async function clearAllKV() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.clear(() => {
        if (chrome.runtime.lastError) {
          console.warn('Chrome storage clear error:', chrome.runtime.lastError)
        }
        resolve()
      })
    })
  }
  
  localStorage.clear()
}

/**
 * Get all keys from storage
 * @returns {Promise<Object>} All stored key-value pairs
 */
export async function getAllKV() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (items) => {
        if (chrome.runtime.lastError) {
          console.warn('Chrome storage get all error:', chrome.runtime.lastError)
          resolve({})
          return
        }
        resolve(items)
      })
    })
  }
  
  // Get all from localStorage
  const items = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        items[key] = JSON.parse(localStorage.getItem(key))
      } catch {
        items[key] = localStorage.getItem(key)
      }
    }
  }
  return items
}
