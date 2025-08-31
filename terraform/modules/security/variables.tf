variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "enable_ssh_access" {
  description = "Enable SSH access"
  type        = bool
  default     = false
}

variable "ssh_allowed_ips" {
  description = "List of IP addresses allowed for SSH access"
  type        = list(string)
  default     = []
}

variable "alb_security_group_id" {
  description = "Security group ID for ALB"
  type        = string
  default     = ""
}