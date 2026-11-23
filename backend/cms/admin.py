from django.contrib import admin

from .models import Enquiry, MediaFile, SiteContent

admin.site.site_header = "MTM Projects Management"
admin.site.site_title = "MTM Admin"


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email", "type", "status", "created_at")
    list_filter = ("status", "type")
    search_fields = ("name", "email", "phone", "message")
    readonly_fields = ("created_at", "updated_at", "ip")


@admin.register(SiteContent)
class SiteContentAdmin(admin.ModelAdmin):
    list_display = ("path", "updated_by", "updated_at")
    search_fields = ("path", "value")


@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ("original", "mime", "size", "created_at")
