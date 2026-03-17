# Project Context

Nombre: Renombrar PDFs

Descripción:
Desktop app to load PDFs and read them to rename the PDFs. 

Objetivo:
Upload PDFs to rename those when downloading them, an excel should be uploaded as reference to renaming

# Core rules

1. Upload PDF files with a button and/or a drag and drop
2. Read the PDF file to extract data
3. Identify type of document. For now files related to Hudbay or Others
4. For Hudbay documents only extract from the first page of the PDF, for Other types, extract from the second page. Only read these pages from pdf uploaded, not other ones. 
User can pick the pdf type to modify in live-time the extracted data
5. User can upload a Excel File that contains useful data to rename PDF, user can use a button or drag and drop to upload this file. The file should contain a "nombre excel" column, this column will be useful to know if the app generates correctly the name of the file
6. Given the extracted data the app should infer the name of the PDF that will be used to rename the uploaded PDF, For example for Hudbay files the format of name should be like "31.01.26 EMPO 76248882 HUAMAN POCCO JESUS YOVANI-G4S PERU SAC.pdf", For other types the format should be like "47281014-CHAMPI MAMANI MARIO-INTERNACIONAL TRANS PERU SAC-EMOA-CMESPINAR-02.02.26"
7. When processing the PDfs to extract data ,user need to know in what percentaje the generated name matches the name in "nombre excel" column. There should be an option where user can pick the name gerated by the app or the name found in the excel file
8. Need to be a preview window to know which data are being processed by the application
9. To identify document type, there should be a logo of Hudbay, if no logo of hudbay or word mentioned the the type should be "other type". Please refer to below files to identify the pattern

## Architecture
Python

## Features
Need to be an executable for windows machines
Need to be an executable for macos machines

## Documents
'/Users/aldair/Proyectos Software/PDF SETTER FILES/SKM_368e26020616500.pdf' is a "Other type" document

''/Users/aldair/Proyectos Software/PDF SETTER FILES/SKM_368e26013117570.pdf' is a Hudbay document