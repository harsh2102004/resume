/**
 * @file src/models/tweet.model.js
 * @description Mongoose schema for short text posts (tweets) by users.
 */

import mongoose, {Schema} from "mongoose";

const tweetSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true})


export const Tweet = mongoose.model("Tweet", tweetSchema)