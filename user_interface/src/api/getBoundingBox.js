import axios from "axios";

const getBoundingBox = async (formData) => {
  try {
    const { data } = await axios.post(
      process.env.VUE_APP_GET_BOUNDING_BOX_URL,
      formData,
      {
        headers: {
          "Content-Type": "multipart/formdata",
        },
      }
    );
    return data;
  } catch (error) {
    console.log(error.response.data);
  }
};

export default getBoundingBox;
