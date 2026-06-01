FROM node:20-alpine

# Install tesseract and Korean language data
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-kor

WORKDIR /app

COPY package*.json ./
COPY apps/ocr/package*.json apps/ocr/

RUN npm install --workspace apps/ocr

COPY apps/ocr apps/ocr

WORKDIR /app/apps/ocr
RUN npx tsc || true

EXPOSE 5000

CMD ["npx", "ts-node-dev", "src/main.ts"]
