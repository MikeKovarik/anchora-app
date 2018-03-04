#include <nan.h>
#include <dwmapi.h>


// Experimental module for enabling undocumentend Windows api for making background of the window blurred
// It's not the native Windows 10 acrylic but some precursor to this. But the blur is shallow and other NWJS
// problems resulted in shelving this code. At least for the time being.

#pragma comment(lib, "dwmapi.lib")

struct AccentPolicy {
	int AccentState;
	int AccentFlags;
	int GradientColor;
	int AnimationId;
};

// WindowCompositionAttributeData
struct WinCompAttrData {
	int Attribute;
	PVOID Data;
	ULONG SizeOfData;
};

enum AccentTypes {
	ACCENT_DISABLE = 0,
	ACCENT_ENABLE_GRADIENT = 1,
	ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
	ACCENT_ENABLE_BLURBEHIND = 3,
	ACCENT_INVALID_STATE = 4
};


NAN_METHOD(setBlurBg) {
	const HINSTANCE hModule = LoadLibrary(TEXT("user32.dll"));
	if (hModule) {
		typedef BOOL(WINAPI*swca)(HWND, WinCompAttrData*);
		const swca SetWindowCompositionAttribute = (swca)GetProcAddress(hModule, "SetWindowCompositionAttribute");
		if (SetWindowCompositionAttribute) {
			bool enabled = true;
			AccentPolicy policy = {enabled ? ACCENT_ENABLE_BLURBEHIND : ACCENT_DISABLE, 0, 0, 0};
			WinCompAttrData data = {19, &policy, sizeof(AccentPolicy)};

			bool result = false;
			HWND hwnd = GetForegroundWindow();
			result = SetWindowCompositionAttribute(hwnd, &data);
			info.GetReturnValue().Set(Nan::New(result));
		}
		FreeLibrary(hModule);
	}
}

NAN_METHOD(getWindowHandle) {
	HWND hwnd = GetForegroundWindow();
	uint32_t uintHandle = (uint32_t)hwnd;
	info.GetReturnValue().Set(Nan::New(uintHandle));
}

// WARNING: the buffer in argument ends up being reversed.
NAN_METHOD(bufferToUint) {
	v8::Local<v8::Object> bufferHandle = info[0]->ToObject();
	if (bufferHandle->IsNull()) return;
	char* buffer = node::Buffer::Data(bufferHandle);
	uint32_t uintHandle = *reinterpret_cast<uint32_t*>(buffer);
	//HWND hwnd = (HWND)uintHandle;
	info.GetReturnValue().Set(Nan::New(uintHandle));
}

NAN_MODULE_INIT(Initialize) {
	NAN_EXPORT(target, setBlurBg);
	NAN_EXPORT(target, getWindowHandle);
	NAN_EXPORT(target, bufferToUint);
}

NODE_MODULE(winblurbg, Initialize);