/**
 * @file src/controllers/healthcheck.controller.js
 * @description Healthcheck endpoint returning 200 OK for container and uptime probes.
 */

import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, {}, "OK")
    )
})

export {
    healthcheck
    }
    