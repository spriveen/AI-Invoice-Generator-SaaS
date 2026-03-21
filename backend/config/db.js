import mongoose from "mongoose";

export const connectDB = async ()=>{
    await mongoose.connect('mongodb+srv://rpeanuka_db_user:riveen123@cluster0.lwjugtw.mongodb.net/InvoiceAI')
    .then(()=> {console.log('DB CONNECTED')})
}