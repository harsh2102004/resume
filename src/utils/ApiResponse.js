/**
 * @file src/utils/ApiResponse.js
 * @description Standardized JSON response envelope ({ statusCode, data, message, success }).
 */

class ApiResponse {
    constructor(statusCode, data, message = "Success"){
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}

export { ApiResponse }