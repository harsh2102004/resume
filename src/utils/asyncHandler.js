/**
 * @file src/utils/asyncHandler.js
 * @description Express async route wrapper forwarding rejected promises to the central error middleware.
 */

const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}


export { asyncHandler };