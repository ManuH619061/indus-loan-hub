"""Domain-specific exceptions raised by services and translated to HTTP responses in the API layer."""


class UnsupportedFileTypeError(Exception):
    def __init__(self, extension: str, allowed: tuple[str, ...]):
        self.extension = extension
        self.allowed = allowed
        super().__init__(
            f"Unsupported file type '.{extension}'. Allowed types: {', '.join(sorted(allowed))}."
        )


class FileTooLargeError(Exception):
    def __init__(self, max_size_mb: int):
        self.max_size_mb = max_size_mb
        super().__init__(f"File exceeds the maximum allowed size of {max_size_mb} MB.")


class InvoiceNotFoundError(Exception):
    def __init__(self, invoice_id: str):
        self.invoice_id = invoice_id
        super().__init__(f"Invoice '{invoice_id}' was not found.")


class ClientNotFoundError(Exception):
    def __init__(self, client_id: str):
        self.client_id = client_id
        super().__init__(f"Client '{client_id}' was not found.")
