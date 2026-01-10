import { z } from "zod";

try {
  const schema = z.number({ message: "Custom error message" });
  const result = schema.safeParse("not a number");
  
  if (!result.success) {
    console.log("Error message:", result.error.issues[0].message);
  } else {
    console.log("Validation passed unexpectedly");
  }
} catch (e) {
  console.error("Crash:", e);
}
