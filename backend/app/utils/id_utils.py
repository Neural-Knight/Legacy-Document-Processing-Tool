import time
def base36_encode(number):
    """Encode a positive number into Base36"""
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    result = ""
    while number:
        number, i = divmod(number, 36)
        result = chars[i] + result
    return result or "0"

def generate_document_id():
    """Generate a unique document ID using base36 encoding of the current timestamp"""
    timestamp = int(time.time())
    return base36_encode(timestamp)