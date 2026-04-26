import dotenv from "dotenv"
import connectDB from "./db/index.js";

dotenv.config({path:'./env'})

connectDB()
.then(()=>{
    // ive written it
    app.on("error",(error)=>{

        console.log("ERR",error);
        throw error
        
    })
    // ****************


    app.listen(process.env.PORT||8000,()=>{


        console.log(`app is listening at port:${process.env.PORT}`)
    })
})
.catch((err)=>{

    console.log("mongodb conection failed:",err)
})


// (async()=>{

//     try{

//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//     } catch (error){

//         console.error("error")
//     }
// })()