import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function test() {
  try {
    const { data, error } = await supabase
      .from("table1")
      .select("*");

    if (error) {
      console.error(error);
    } else {
      console.log("Connected!");
      console.log(data);
    }
  } catch (err) {
    console.error(err);
  }
}

test();