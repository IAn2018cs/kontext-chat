import { Hono } from 'hono';
import Replicate from 'replicate';
import OpenAI from 'openai';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface Env {
        REPLICATE_API_TOKEN: string;
        OPENAI_API_KEY: string;
        OPENAI_BASE_URL?: string;
        AWS_ACCESS_KEY_ID: string;
        AWS_SECRET_ACCESS_KEY: string;
        AWS_REGION: string;
        AWS_BUCKET_NAME: string;
        REPLICATE_MODEL: string;
        REPLICATE_MODELS: string; // JSON 格式的模型列表
}

const app = new Hono<{ Bindings: Env }>();

async function uploadToS3(
        imageUrl: string,
        bucketName: string,
        region: string,
        accessKeyId: string,
        secretAccessKey: string,
        keyPrefix: string = 'images'
): Promise<string> {
        try {
                // Fetch the image from Replicate
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                }

                const imageBytes = await imageResponse.arrayBuffer();

                // Initialize S3 client
                const s3Client = new S3Client({
                        region: region,
                        credentials: {
                                accessKeyId: accessKeyId,
                                secretAccessKey: secretAccessKey,
                        },
                });

                // Generate a unique filename
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(2, 15);
                const fileName = `${keyPrefix}/${timestamp}-${randomString}.jpg`;

                // Upload to S3
                const uploadCommand = new PutObjectCommand({
                        Bucket: bucketName,
                        Key: fileName,
                        Body: new Uint8Array(imageBytes),
                        ContentType: 'image/jpeg',
                        // Optional: Set ACL to public-read if you want the image to be publicly accessible
                        ACL: 'public-read',
                });

                const uploadResult = await s3Client.send(uploadCommand);

                if (uploadResult.$metadata.httpStatusCode !== 200) {
                        throw new Error(`S3 upload failed with status: ${uploadResult.$metadata.httpStatusCode}`);
                }

                // Return the S3 URL for the uploaded image
                // If using public-read ACL:
                const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
                console.log('Image uploaded to S3:', s3Url);
                return s3Url;

                // If bucket is configured with CloudFront or custom domain:
                // return `https://your-cloudfront-domain.com/${fileName}`;

        } catch (error) {
                console.error('Error uploading to S3:', error);
                throw error;
        }
}

// Helper function to translate prompt to English using OpenAI
async function translatePromptToEnglish(
        prompt: string,
        openaiApiKey: string,
        baseURL?: string
): Promise<string> {
        try {
                // Check if the prompt is already in English (simple heuristic)
                const englishPattern = /^[a-zA-Z0-9\s.,!?'"()-]+$/;
                if (englishPattern.test(prompt)) {
                        return prompt; // Already in English, no translation needed
                }

                const openai = new OpenAI({
                        apiKey: openaiApiKey,
                        baseURL: baseURL,
                });

                const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                                {
                                        role: 'system',
                                        content: 'You are a professional translator. Translate the given text to English. Only return the translated text, no explanations or additional content.'
                                },
                                {
                                        role: 'user',
                                        content: prompt
                                }
                        ],
                        max_tokens: 500,
                        temperature: 0.3,
                });

                const translatedPrompt = response.choices[0]?.message?.content?.trim();

                if (!translatedPrompt) {
                        console.warn('Translation failed, using original prompt');
                        return prompt;
                }

                return translatedPrompt;
        } catch (error) {
                console.error('Error translating prompt:', error);
                // Return original prompt if translation fails
                return prompt;
        }
}

// Add a new route for getting available models
app.get('/models', async (c) => {
        try {
                // Parse the models from environment variable
                const modelsJson = c.env.REPLICATE_MODELS;
                if (!modelsJson) {
                        return c.json({ error: 'No models configured' }, 500);
                }
                
                const models = JSON.parse(modelsJson);
                return c.json({ models });
        } catch (error) {
                console.error('Error parsing models:', error);
                return c.json({ error: 'Failed to get models' }, 500);
        }
});

app.post('/generate-image', async (c) => {
        try {
                const replicate = new Replicate({ auth: c.env.REPLICATE_API_TOKEN });
                
                const { prompt, input_image, model } = await c.req.json();

                // Use the model from request, fallback to default environment variable
                const selectedModel = model || c.env.REPLICATE_MODEL;
                const replicateModel = selectedModel as `${string}/${string}` | `${string}/${string}:${string}`;

                // Translate prompt to English if needed
                const translatedPrompt = await translatePromptToEnglish(
                        prompt,
                        c.env.OPENAI_API_KEY,
                        c.env.OPENAI_BASE_URL
                );

                console.log('Original prompt:', prompt);
                console.log('Translated prompt:', translatedPrompt);
                console.log('Using model:', selectedModel);

                // Generate image with Replicate using translated prompt
                const output = await replicate.run(replicateModel, {
                        input: {
                                prompt: translatedPrompt,
                                input_image,
                        },
                });

                const replicateImageUrl = output as unknown as string;

                // Upload to S3 for permanent storage
                const s3ImageUrl = await uploadToS3(
                        replicateImageUrl,
                        c.env.AWS_BUCKET_NAME,
                        c.env.AWS_REGION,
                        c.env.AWS_ACCESS_KEY_ID,
                        c.env.AWS_SECRET_ACCESS_KEY
                );

                // Return the S3 URL
                return c.json({ imageUrl: s3ImageUrl });
        } catch (error) {
                console.error('Error in generate-image:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return c.json({ error: errorMessage }, 500);
        }
});

// Add a new route for fetching images to avoid CORS issues
app.get('/fetch-image', async (c) => {
        const imageUrl = c.req.query('url');
        if (!imageUrl) {
                return c.json({ error: 'Missing image URL' }, 400);
        }

        try {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                        // MODIFIED: Pass status code directly
                        return c.json({ error: 'Failed to fetch image' }, response.status as any);
                }
                // Ensure the content type is set correctly
                const newHeaders = new Headers(response.headers);
                newHeaders.set('Access-Control-Allow-Origin', '*'); // Allow any origin

                return new Response(response.body, {
                        headers: newHeaders,
                        status: response.status,
                });
        } catch (error) {
                console.error('Error fetching image:', error);
                // MODIFIED: Pass status code directly
                return c.json({ error: 'Failed to fetch image' }, 500 as any);
        }
});

export default app;
