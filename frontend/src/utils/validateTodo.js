export function validateTodoTitle(title) {
    if (typeof title !== "string") {
        return false;
    }

    const value = title.trim();
    return value.length > 0 && value.length <= 100;
}