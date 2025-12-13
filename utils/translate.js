const axios = require("axios");

// Generic MyMemory translation function
const translateWithMyMemory = async (text, targetLang) => {
  try {
    const langpair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${langpair}`;

    const res = await axios.get(url);
    const data = res.data;

    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    } else {
      console.warn(" No translation returned:", data);
      return text;
    }
  } catch (e) {
    console.error("MyMemory error:", e.message);
    return text;
  }
};

// Translate product fields (name & description) into FR & AR
const translateProduct = async (name, description) => {
  const result = {
    name: { en: name, fr: name, ar: name },
    description: { en: description, fr: description, ar: description },
  };

  // Translate Name
  result.name.fr = await translateWithMyMemory(name, "fr");
  result.name.ar = await translateWithMyMemory(name, "ar");

  // Translate Description
  result.description.fr = await translateWithMyMemory(description, "fr");
  result.description.ar = await translateWithMyMemory(description, "ar");

  return result;
};

module.exports = { translateWithMyMemory, translateProduct };
