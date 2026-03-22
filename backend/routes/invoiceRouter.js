import express from 'express';


import { clerkMiddleware } from '@clerk/express';
import { createInvoice, deleteInvoice, getInvoiceById, getInvoices, updateInvoice } from '../controllers/invoiceController.js';

const invoiceRouter = express.Router();

invoiceRouter.use(clerkMiddleware());

invoiceRouter.get("/", getInvoices);
invoiceRouter.get("/:id", getInvoiceById);
invoiceRouter.post("/", createInvoice);
invoiceRouter.put("/:id", updateInvoice);
invoiceRouter.delete("/:id", deleteInvoice);

export default invoiceRouter;

