import mongoose, {Schema} from "mongoose";
import jwt from"jsonwebtoken"
import bcrypt from "bcrypt"
 const UserSchema=new Schema({
username:{

    type:string,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    index:true
},
email:{

    type:string,
    required:true,
    unique:true,
    lowercase:true,
    trim:true,
    
},
fullName:{

    type:string,
    required:true,
    trim:true,
    
},

avatar:{

    type:string ,//cloudinary
    required:true,
    
},
coverImage:{

    type:string ,//cloudinary
    
    
},
watchHistory:[
    {

    type:Schema.Types.ObjectId,
    ref:"Video"
}
],
password:{
    type:string,
    required:[true,'pw is required']


},
refreshTokens:{
    type:string
}



 },{timestamps:true})
 //creates a problem of updating every time

 //dont use arrow f bcz of this and it is slow process async
 UserSchema.pre("save",async function (next) {
 if (!this.isModified("password")) return next()

    this.password+bcrypt.hash(this.password,10)
    next()
    
 })
 // Hum ek custom method bana rahe hain "isPasswordCorrect" naam ka
userSchema.methods.isPasswordCorrect = async function(password){
    // bcrypt.compare check karta hai: (Plain Password, Hashed Password)
    // 'this.password' ka matlab hai database wala hashed password
    return await bcrypt.compare(password, this.password)
}
 
// 1. Access Token generate karne ka method
userSchema.methods.generateAccessToken = function(){
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
userSchema.methods.generateRefreshToken = function(){
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



 export const user=mongoose.model("User",UserSchema)