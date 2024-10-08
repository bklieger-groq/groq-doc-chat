import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, streamObject } from 'ai'
import { PartialRelated, relatedSchema } from '@/lib/schema/related'
import SearchRelated from '@/components/search-related'
import { createOpenAI } from '@ai-sdk/openai'

export async function querySuggestor(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: CoreMessage[]
) {
  const objectStream = createStreamableValue<PartialRelated>()
  uiStream.append(<SearchRelated relatedQueries={objectStream.value} />)

  const lastMessages = messages.slice(-1).map(message => {
    return {
      ...message,
      role: 'user'
    }
  }) as CoreMessage[]

  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  })

  let finalRelatedQueries: PartialRelated = {}
  await streamObject({
    model: groq("llama3-8b-8192"),
    system: `As a development documentation assistant, your task is to generate a set of three queries that explore the subject matter more deeply, building upon the initial query and the information uncovered in its search results.

    For instance, if the original query was "How can I integrate Groq into my app?", your output should follow this format:

    "{
      "related": [
        "What client libraries does Groq have?",
        "What are Groq's quickstart instructions?",
        "Can Groq integrate into an OpenAI app?"
      ]
    }"

    Aim to create queries that address a broad range of potential questions about the documentation that would very likely be well documented. For instance, broad questions about inference in general may not be well supported, but questions about what models are on Groq would be.
    Please match the language of the response to the user's language.
    `,
    messages: lastMessages,
    schema: relatedSchema
  })
    .then(async result => {
      for await (const obj of result.partialObjectStream) {
        if (obj.items) {
          objectStream.update(obj)
          finalRelatedQueries = obj
        }
      }
    })
    .finally(() => {
      objectStream.done()
    })

  return finalRelatedQueries
}
