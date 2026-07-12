import mongoose, {Schema} from "mongoose";
import jwt from"jsonwebtoken"
import bcrypt from "bcrypt"
 const UserSchema=new Schema({
username:{

    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    index:true
},
email:{

    type:String,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    
},
fullName:{

    type:String,
    required:true,
    trim:true,
    
},

avatar:{

    type:String ,//cloudinary
    required:true,
    
},
coverImage:{

    type:String ,//cloudinary
    
    
},
watchHistory:[
    {

    type:Schema.Types.ObjectId,
    ref:"Video"
}
],
password:{
    type:String,
    required:[true,'pw is required']


},
refreshTokens:{
    type:String
}



 },{timestamps:true})
 //creates a problem of updating every time

 //dont use arrow f bcz of this and it is slow process async
 UserSchema.pre("save",async function (next) {
 if (!this.isModified("password")) return ;
 //dont use next here

    this.password = await bcrypt.hash(this.password,10)
    
    
 })
 // Hum ek custom method bana rahe hain "isPasswordCorrect" naam ka
UserSchema.methods.isPasswordCorrect = async function(password){
    // bcrypt.compare check karta hai: (Plain Password, Hashed Password)
    // 'this.password' ka matlab hai database wala hashed password
    return await bcrypt.compare(password, this.password)
}
 
// 1. Access Token generate karne ka method
UserSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            // Payload (Data jo token ke andar rahega)
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
// 2. Refresh Token generate karne ka method
UserSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}



 const User = mongoose.model("User",UserSchema)

 export default User
