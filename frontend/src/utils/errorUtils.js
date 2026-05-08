/**
 * Extracts a user-friendly error message from a DRF (Django Rest Framework) error response.
 * Handles strings, arrays, nested objects, and ErrorDetail objects.
 */
export const getErrorMessage = (data) => {
  if (!data) return "Something went wrong";
  
  // If it's already a string, return it
  if (typeof data === "string") return data;
  
  // If it's an array, recursively check the first element
  if (Array.isArray(data)) {
    return getErrorMessage(data[0]);
  }
  
  // If it's an object, check for common keys or recurse into values
  if (typeof data === "object") {
    // DRF ErrorDetail object: { string: "...", code: "..." }
    if (data.string) return data.string;
    
    // Generic DRF error keys
    if (data.detail) return getErrorMessage(data.detail);
    if (data.error) return getErrorMessage(data.error);
    if (data.non_field_errors) return getErrorMessage(data.non_field_errors);
    
    // Field-specific errors: return the first one found
    const values = Object.values(data);
    if (values.length > 0) {
      return getErrorMessage(values[0]);
    }
  }
  
  // Fallback to JSON stringification if all else fails
  try {
    return JSON.stringify(data);
  } catch (e) {
    return "An unexpected error occurred";
  }
};
