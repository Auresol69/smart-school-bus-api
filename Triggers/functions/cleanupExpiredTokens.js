exports = async function cleanupExpiredTokens(){
    const service = context.services.get("mongodb-atlas");

    const db = service.db("SSB")

    const usersCollection = db.collection("users");

    const now = new Date();

    try {
     const result = await usersCollection.updateMany({},
        {
            $pull:{
                refreshToken: {
                    expiredAt : {$lt: now}
                }
            }
        }
    );  
        console.log(`Cleanup complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

        return result;

    } catch (error) {
        console.log("Error during scheduled trigger cleanup: ",error);
        return { error: error.message };
    }

    // Mo rong: tu dong send mail ve tai khoan de biet duoc da xoa rac xong (emailjs, sendgrid)
}