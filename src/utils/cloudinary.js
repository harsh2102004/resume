import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'


    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key:  process.env.CLOUDINARY_API_KEY, 
        api_secret:process.env.CLOUDINARY_API_SECRET})
         const uploadonclodinary=async (localfilepath)=>{
try{
if(!localfilepath) return null
//upload file
  const response= await cloudinary.uploader.upload(localfilepath,{

   resource_type:"auto" 
})
//file hasbeen uploaded
console.log("uploaded on cloudianry",response.url)
// 2. 🔥 SUCCESS! File upload ho gayi, ab local server se delete karo
        fs.unlinkSync(localfilepath);
return response;
}

catch{
//remove the locally save tamporary file as the uplad opt got failed
    fs.unlinkSync(localfilepath)



}

         }
         export{uploadonclodinary}