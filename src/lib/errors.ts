/**
 * Translates Firebase and custom errors into user-friendly messages.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (error && error.code) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/invalid-email':
      case 'auth/wrong-password':
        return 'Invalid email or password. Please try again.';
      
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      
      case 'auth/too-many-requests':
        return 'Access temporarily disabled due to too many failed attempts. Please reset your password or try again later.';

      case 'auth/email-already-in-use':
        return 'An account with this email address already exists.';

      // Our custom error from the vault decryption
      case 'Invalid password.':
        return 'Invalid password. Vault decryption failed.';
      
      default:
        return 'An unknown error occurred. Please try again.';
    }
  }
  
  // Fallback for non-Firebase errors
  if (error && error.message) {
    return error.message;
  }

  return 'An unknown error occurred.';
}