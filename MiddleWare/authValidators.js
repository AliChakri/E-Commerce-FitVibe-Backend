// utils/authValidators.js
const validator = require("validator");

// ========================================
// LOGIN VALIDATION
// ========================================
const validateLogin = (email, password) => {
    const errors = {};

    // Email validation
    if (!email) {
        errors.email = "Email is required";
    } else if (!validator.isEmail(email)) {
        errors.email = "Please provide a valid email address";
    }

    // Password validation
    if (!password) {
        errors.password = "Password is required";
    } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters";
    }

    return errors;
};

// ========================================
//  REGISTER VALIDATION
// ========================================
const validateRegister = (firstName, lastName, email, password, dateOfBirth) => {
    const errors = {};

    // First name validation
    if (!firstName) {
        errors.firstName = "First name is required";
    } else if (firstName.trim().length < 2) {
        errors.firstName = "First name must be at least 2 characters";
    } else if (firstName.trim().length > 50) {
        errors.firstName = "First name cannot exceed 50 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
        errors.firstName = "First name can only contain letters, spaces, hyphens, and apostrophes";
    }

    // Last name validation
    if (!lastName) {
        errors.lastName = "Last name is required";
    } else if (lastName.trim().length < 2) {
        errors.lastName = "Last name must be at least 2 characters";
    } else if (lastName.trim().length > 50) {
        errors.lastName = "Last name cannot exceed 50 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
        errors.lastName = "Last name can only contain letters, spaces, hyphens, and apostrophes";
    }

    // Email validation
    if (!email) {
        errors.email = "Email is required";
    } else if (!validator.isEmail(email)) {
        errors.email = "Please provide a valid email address";
    } else if (email.length > 255) {
        errors.email = "Email is too long";
    }

    // Password validation with detailed feedback
    if (!password) {
        errors.password = "Password is required";
    } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long";
    } else if (password.length > 128) {
        errors.password = "Password is too long (max 128 characters)";
    } else if (!validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        errors.password = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
    }

    // Date of birth validation
    if (!dateOfBirth) {
        errors.dateOfBirth = "Date of birth is required";
    } else {
        const dob = new Date(dateOfBirth);
        const today = new Date();
        
        // Check if valid date
        if (isNaN(dob.getTime())) {
            errors.dateOfBirth = "Please provide a valid date";
        } else {
            if (dob > today) {
                errors.dateOfBirth = "Date of birth cannot be in the future";
            }
            
            // Calculate age
            const age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            const dayDiff = today.getDate() - dob.getDate();
            
            let calculatedAge = age;
            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                calculatedAge--;
            }
            
            if (calculatedAge < 13) {
                errors.dateOfBirth = "You must be at least 13 years old to register";
            }
            
            if (calculatedAge > 120) {
                errors.dateOfBirth = "Please provide a valid date of birth";
            }
        }
    }

    return errors;
};

// ========================================
//  RESET PASSWORD VALIDATION
// ========================================
const validateResetPassword = (password) => {
    const errors = {};

    if (!password) {
        errors.password = "Password is required";
    } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long";
    } else if (password.length > 128) {
        errors.password = "Password is too long (max 128 characters)";
    } else if (!validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        errors.password = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
    }

    return errors;
};

// ========================================
//  CHANGE PASSWORD VALIDATION
// ========================================
const validateChangePassword = (password) => {
    const errors = {};

    if (!password) {
        errors.password = "New password is required";
    } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long";
    } else if (password.length > 128) {
        errors.password = "Password is too long (max 128 characters)";
    } else if (!validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        errors.password = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
    }

    return errors;
};

// ========================================
//  EMAIL VALIDATION
// ========================================
const validateEmail = (email) => {
    const errors = {};

    if (!email) {
        errors.email = "Email is required";
    } else if (!validator.isEmail(email)) {
        errors.email = "Please provide a valid email address";
    } else if (email.length > 255) {
        errors.email = "Email is too long";
    }

    return errors;
};

// ========================================
// PROFILE UPDATE VALIDATION
// ========================================
const validateProfileUpdate = (data) => {
    const errors = {};

    // First name validation
    if (data.firstName !== undefined) {
        if (data.firstName.trim().length < 2) {
            errors.firstName = "First name must be at least 2 characters";
        } else if (data.firstName.trim().length > 50) {
            errors.firstName = "First name cannot exceed 50 characters";
        } else if (!/^[a-zA-Z\s'-]+$/.test(data.firstName)) {
            errors.firstName = "First name can only contain letters, spaces, hyphens, and apostrophes";
        }
    }

    // Last name validation
    if (data.lastName !== undefined) {
        if (data.lastName.trim().length < 2) {
            errors.lastName = "Last name must be at least 2 characters";
        } else if (data.lastName.trim().length > 50) {
            errors.lastName = "Last name cannot exceed 50 characters";
        } else if (!/^[a-zA-Z\s'-]+$/.test(data.lastName)) {
            errors.lastName = "Last name can only contain letters, spaces, hyphens, and apostrophes";
        }
    }

    // Phone validation (if provided)
    if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
        if (!validator.isMobilePhone(data.phone, 'any', { strictMode: false })) {
            errors.phone = "Please provide a valid phone number";
        }
    }

    // Address validation
    if (data.address) {
        if (data.address.country && data.address.country.length > 100) {
            errors.addressCountry = "Country name is too long";
        }
        if (data.address.city && data.address.city.length > 100) {
            errors.addressCity = "City name is too long";
        }
        if (data.address.postalCode && data.address.postalCode.length > 20) {
            errors.addressPostalCode = "Postal code is too long";
        }
        if (data.address.street && data.address.street.length > 200) {
            errors.addressStreet = "Street address is too long";
        }
    }

    // Avatar validation (if provided)
    if (data.avatar !== undefined && data.avatar !== null && data.avatar !== '') {
        // Check if it's a valid URL or base64 image
        const isValidUrl = validator.isURL(data.avatar, { 
            protocols: ['http', 'https'],
            require_protocol: true 
        });
        const isBase64 = /^data:image\/(png|jpg|jpeg|gif|webp);base64,/.test(data.avatar);
        
        if (!isValidUrl && !isBase64) {
            errors.avatar = "Avatar must be a valid URL or base64 image";
        }
    }

    return errors;
};

module.exports = {
    validateLogin,
    validateRegister,
    validateResetPassword,
    validateChangePassword,
    validateEmail,
    validateProfileUpdate
};