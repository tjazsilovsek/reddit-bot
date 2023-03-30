import { APIGatewayProxyHandler } from 'aws-lambda';
import { Configuration, OpenAIApi } from 'openai';
import Snoowrap from 'snoowrap';

import dotenv from 'dotenv';

dotenv.config();

const reddit = new Snoowrap({
  userAgent: 'daily_question_bot v0.1',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
});

const generatePrompt = (popularQuestions: string[]) => {

  if (popularQuestions.length > 20) {
    popularQuestions = popularQuestions.slice(0, 20);
  }

  let prompt = 'Generate one question for r/AskReddit that is inspired by these popular questions:\n\n';

  popularQuestions.forEach((question, i) => {
    prompt += `${i + 1}. ${question}\n\n`;
  });

  prompt += 'Question can be humorous, technical or philosophical, etc.Try to be as original and creative as possible. Return only one question.';

  return prompt;
};


const generateQuestion = async (popularQuestions: string[]) => {

  

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const prompt = generatePrompt(popularQuestions);

  const configuration = new Configuration({
    apiKey: openaiApiKey,
  });

  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    max_tokens: 300,
    n: 1,
    temperature: 0.8,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],

  });

  return response.data.choices[0].message;
};

const getMostPopularQuestion = async () => {

  const subredditName = 'AskReddit';

  const posts = await reddit.getSubreddit(subredditName).getHot({ limit: 11});


  // remove the first post, which is the sticky post
  posts.shift();

  const questions = posts.map((post) => post.title);


  return questions;
}


const postToReddit = async (question: string) => {
  
  const subredditName = 'AskReddit';

  const subreddit = reddit.getSubreddit(subredditName).submitSelfpost({ title: question, subredditName: subredditName });

  if (subreddit) {
    console.log('Question posted successfully');
  }

};

export const handler: APIGatewayProxyHandler = async () => {
  try {

    const popular = await getMostPopularQuestion();
    const question = await generateQuestion(popular);
    if (!question) {
      return {
        statusCode: 500,
        body: 'An error occurred while generating the question',
      };
    }
    await postToReddit(question.content);

    return {
      statusCode: 200,
      body: `Question: "${question.content}" posted successfully`,
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: 'An error occurred while posting the question',
    };
  }
};