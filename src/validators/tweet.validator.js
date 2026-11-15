import { z } from "zod";

export const tweetSchema = z.object({
    content: z.string().min(1, "Tweet content cannot be empty"),
});

