async function getTraceId(instance) {
    return await instance.getTraceId.call();
}

module.exports = {
    getTraceId
};
