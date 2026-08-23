from fastapi import HTTPException, status


class AppError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code

    def to_http_exception(self) -> HTTPException:
        return HTTPException(status_code=self.status_code, detail=self.message)


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid email or password") -> None:
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status.HTTP_404_NOT_FOUND)


class InvalidImageError(AppError):
    def __init__(self, message: str = "The uploaded file is not a valid image") -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST)


class FileTooLargeError(AppError):
    def __init__(self, max_mb: int) -> None:
        super().__init__(
            f"File exceeds the maximum allowed size of {max_mb} MB",
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )


class NoFaceDetectedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "No face was detected in the uploaded image. Please upload a clear photo of a face.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class MultipleFacesError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "Please upload an image containing exactly one face.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "The requested service is not ready yet") -> None:
        super().__init__(message, status.HTTP_503_SERVICE_UNAVAILABLE)


class InvalidAudioError(AppError):
    def __init__(self, message: str = "The uploaded file is not a valid audio recording") -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST)


class ConflictError(AppError):
    def __init__(self, message: str = "This action conflicts with the current state") -> None:
        super().__init__(message, status.HTTP_409_CONFLICT)


class InvalidRecordingError(AppError):
    def __init__(self, message: str = "The uploaded file is not a valid session recording") -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST)
