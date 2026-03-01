import ImageKit from "imagekit";

const getImageKitClient = () => {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

    if (!publicKey || !privateKey || !urlEndpoint) {
        throw new Error("IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are required")
    }

    return new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint
    })
}

export { getImageKitClient }