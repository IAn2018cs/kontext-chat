import { Hono } from 'hono';
import Replicate from 'replicate';
import OpenAI from 'openai';

interface Env {
        REPLICATE_API_TOKEN: string;
        CLOUDFLARE_ACCOUNT_ID: string;
        CLOUDFLARE_IMAGES_API_TOKEN: string;
        OPENAI_API_KEY: string;
        OPENAI_BASE_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Helper function to upload image to Cloudflare Images
async function uploadToCloudflareImages(
        imageUrl: string,
        accountId: string,
        apiToken: string
): Promise<string> {
        try {
                // Fetch the image from Replicate
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                }

                const imageBytes = await imageResponse.arrayBuffer();

                // Create form data for upload
                const formData = new FormData();
                formData.append('file', new File([imageBytes], 'generated-image.jpg', { type: 'image/jpeg' }));

                // Upload to Cloudflare Images
                const uploadResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
                        method: 'POST',
                        headers: {
                                'Authorization': `Bearer ${apiToken}`,
                        },
                        body: formData,
                });

                if (!uploadResponse.ok) {
                        const errorText = await uploadResponse.text();
                        throw new Error(`Cloudflare Images upload failed: ${uploadResponse.status} - ${errorText}`);
                }

                const uploadResult = await uploadResponse.json() as any;

                if (!uploadResult.success) {
                        throw new Error(`Cloudflare Images upload failed: ${JSON.stringify(uploadResult.errors)}`);
                }

                // Return the delivery URL for the uploaded image
                return uploadResult.result.variants[0]; // Get the first variant URL
        } catch (error) {
                console.error('Error uploading to Cloudflare Images:', error);
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

app.post('/generate-image', async (c) => {
        try {
                // Require Replicate API token from header
                const userToken = c.req.header('X-Replicate-Api-Token');
                if (!userToken) {
                        return c.json({ error: 'Missing Replicate API token. Please provide it in the X-Replicate-Api-Token header.' }, 400);
                }
                const replicate = new Replicate({ auth: userToken });
                const model = 'black-forest-labs/flux-kontext-pro';

                const { prompt, input_image } = await c.req.json();

                // Translate prompt to English if needed
                const translatedPrompt = await translatePromptToEnglish(
                        prompt,
                        c.env.OPENAI_API_KEY,
                        c.env.OPENAI_BASE_URL
                );

                console.log('Original prompt:', prompt);
                console.log('Translated prompt:', translatedPrompt);

                // Generate image with Replicate using translated prompt
                const output = await replicate.run(model, {
                        input: {
                                prompt: translatedPrompt,
                                input_image,
                        },
                });

                const replicateImageUrl = output as unknown as string;

                // Upload to Cloudflare Images for permanent storage
                const cloudflareImageUrl = await uploadToCloudflareImages(
                        replicateImageUrl,
                        c.env.CLOUDFLARE_ACCOUNT_ID,
                        c.env.CLOUDFLARE_IMAGES_API_TOKEN
                );

                // Return the Cloudflare Images URL instead of the temporary Replicate URL
                return c.json({ imageUrl: cloudflareImageUrl });
        } catch (error) {
                console.error('Error in generate-image:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return c.json({ error: errorMessage }, 500);
        }
});

export default app;
