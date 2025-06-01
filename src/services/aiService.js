const OpenAI = require('openai');

async function solveQuiz(quizData) {
    
    // Return early if quizData.data is empty
    if (!quizData.data || Object.keys(quizData.data).length === 0) {
        return "Aucune donnée de quiz disponible pour l'analyse.";
    }

    try {
        const openai = new OpenAI({
            baseURL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY
        });

        const completion = await openai.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "Vous êtes un assistant spécialisé dans la résolution de quiz . Fournissez des réponses brèves en français." 
                },
                { 
                    role: "user", 
                    content: `Nous sommes dans le domaine de la SGBD NOSQL et Lac de données. Veuillez résoudre ce quiz : ${JSON.stringify(quizData.data.generated)}` 
                }
            ],
            model: "deepseek-chat",
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error solving quiz with AI:', error);
        
        // Handle specific error cases
        if (error.status === 402) {
            throw new Error('Le service AI est actuellement indisponible en raison d\'un solde insuffisant. Veuillez réessayer plus tard ou contacter le support.');
        }
        
        // Handle other potential errors
        if (error.status === 401) {
            throw new Error('L\'authentification du service AI a échoué. Veuillez vérifier vos identifiants API.');
        }
        
        if (error.status === 429) {
            throw new Error('Limite de taux du service AI dépassée. Veuillez réessayer plus tard.');
        }
        
        // For any other errors, throw a generic error
        throw new Error('Échec de l\'obtention de la solution AI. Veuillez réessayer plus tard.');
    }
}

async function extractQuizFromHtml(html) {
    try {
        const openai = new OpenAI({
            baseURL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY
        });

        const completion = await openai.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "Vous êtes un assistant spécialisé dans l'extraction de QCM à partir de pages HTML. Votre tâche est d'analyser le HTML fourni et d'extraire uniquement les questions et réponses du QCM, en les structurant de manière claire et organisée." 
                },
                { 
                    role: "user", 
                    content: `A noter que s'il n'y a pas de QCM dans le HTML, veuillez répondre "NONE". Veuillez extraire le QCM de ce HTML : ${html}` 
                }
            ],
            model: "deepseek-chat",
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error extracting quiz from HTML:', error);
        
        // Handle specific error cases
        if (error.status === 402) {
            throw new Error('Le service AI est actuellement indisponible en raison d\'un solde insuffisant. Veuillez réessayer plus tard ou contacter le support.');
        }
        
        if (error.status === 401) {
            throw new Error('L\'authentification du service AI a échoué. Veuillez vérifier vos identifiants API.');
        }
        
        if (error.status === 429) {
            throw new Error('Limite de taux du service AI dépassée. Veuillez réessayer plus tard.');
        }
        
        throw new Error('Échec de l\'extraction du QCM. Veuillez réessayer plus tard.');
    }
}

module.exports = {
    solveQuiz,
    extractQuizFromHtml
}; 