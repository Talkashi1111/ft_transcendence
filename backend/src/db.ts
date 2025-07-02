// Simple in-memory counter implementation
let counterValue = 0;

// Counter operations
export const counterOperations = {
  getValue: (): { value: number } | null => {
    return { value: counterValue };
  },

  setValue: (value: number): { value: number } => {
    counterValue = value;
    return { value: counterValue };
  }
};

// Export a dummy object for compatibility
export default {};
