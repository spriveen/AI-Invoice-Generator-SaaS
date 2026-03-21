import express from  'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const port = 4000;

// MIDDLEAWARE

// DB

// ROUTE

app.get('/', (req,res)=>{
    res.send("API WORKING")
});

app.listen(port, ()=>{
    console.log(`Server Started on http://localhost:${port}`);
})