import { useEffect, useCallback } from 'react';
import { UseFormWatch, UseFormSetValue } from 'react-hook-form';

export function useFormPersistence<T extends Record<string, unknown>>(
  key: string,
  watch: UseFormWatch<T>,
  setValue: UseFormSetValue<T>,
  dependencies: (keyof T & string)[] = []
) {
  const storageKey = `form_persistence_${key}`;

  useEffect(() => {
    const loadTimeout = setTimeout(() => {
      try {
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
          const parsedData = JSON.parse(savedData) as Partial<T>;
          
          Object.entries(parsedData).forEach(([fieldName, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              setValue(fieldName as keyof T, value as T[keyof T], { 
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false
              });
            }
          });
        }
      } catch (error) {
        console.warn('Failed to load form data from localStorage:', error);
      }
    }, 100);
    
    return () => clearTimeout(loadTimeout);
  }, [storageKey, setValue]);

  const saveToStorage = useCallback(() => {
    try {
      const currentData = dependencies.length > 0 
        ? dependencies.reduce((acc, key) => {
            acc[key] = watch(key);
            return acc;
          }, {} as Partial<T>)
        : watch();

      const filteredData = Object.entries(currentData).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            acc[key] = value;
          } else if (typeof value === 'object' && value !== null) {
            const hasValues = Object.values(value).some(v => v !== undefined && v !== null && v !== '');
            if (hasValues) {
              acc[key] = value;
            }
          } else if (typeof value !== 'object') {
            acc[key] = value;
          }
        }
        return acc;
      }, {} as Record<string, unknown>);

      localStorage.setItem(storageKey, JSON.stringify(filteredData));
    } catch (error) {
      console.warn('Failed to save form data to localStorage:', error);
    }
  }, [storageKey, watch, dependencies]);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear persisted form data:', error);
    }
  }, [storageKey]);

  return {
    saveToStorage,
    clearPersistedData
  };
}