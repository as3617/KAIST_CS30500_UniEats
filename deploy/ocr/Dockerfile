FROM node:20-alpine

# Install tesseract with Korean/English language data.
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-chi_tra \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-kor \
    ttf-dejavu

WORKDIR /app

COPY package*.json ./
COPY apps/ocr/package*.json apps/ocr/

RUN npm install --workspace apps/ocr

COPY apps/ocr apps/ocr

WORKDIR /app/apps/ocr
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
