import express from 'express';
import { MongoClient } from 'mongodb';
import 'dotenv/config'
import cors from 'cors'

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


const mongoClient=await connectToMongoDB();
const db=mongoClient.db("booknook")
const newBookCollection=db.collection("books")



app.get('/', (req, res) => {
  res.send('Hello World!');
});


app.post("/add-book", async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      userName,
      userEmail,
    } = req.body;

    if (
      !title ||
      !author ||
      !category ||
      !image ||
      !description ||
      !userName ||
      !userEmail
    ) {
      return res.status(400).send({
        message: "All fields are required.",
      });
    }

    const newBook = {
      title,
      author,
      category,
      image,
      description,
      userName,
      userEmail,
      createdAt: new Date(),
    };

    const result = await db.newBookCollection.insertOne(newBook);

    res.status(201).send({
      success: true,
      message: "Book added successfully!",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("Add book error:", error);

    res.status(500).send({
      message: "Failed to add book.",
    });
  }
});

app.get("/books",async(req,res)=>{
  const result=newBookCollection.find().toArray()
  res.send(result)
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});